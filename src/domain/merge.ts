/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Per-record merge for the shared-repository mode. Entries and bills are the
 * conflict unit: additions from different users are unioned, and the newest
 * update wins for the same id. Shared configuration is unioned by id with the
 * remote copy winning duplicates.
 */

import type {
    Actor,
    Bill,
    Book,
    Entry,
    Member,
    RecurringRule,
    Tombstone,
} from "@/types";

function recordTime(record: {
    updatedAt?: number;
    createdAt?: number;
}): number {
    return record.updatedAt ?? record.createdAt ?? 0;
}

type MergeableRecord = {
    id: string;
    updatedAt?: number;
    createdAt?: number;
    fieldUpdatedAt?: Record<string, number>;
};

function mergeFieldMaps(
    local: Record<string, number> | undefined,
    remote: Record<string, number> | undefined,
): Record<string, number> | undefined {
    if (!local && !remote) {
        return undefined;
    }
    const result: Record<string, number> = { ...(local ?? {}) };
    for (const [key, timestamp] of Object.entries(remote ?? {})) {
        result[key] = Math.max(result[key] ?? 0, timestamp);
    }
    return result;
}

function mergeRecord<T extends MergeableRecord>(
    local: T,
    remote: T,
    fields: string[],
): T {
    const localTime = recordTime(local);
    const remoteTime = recordTime(remote);
    const base = remoteTime >= localTime ? remote : local;
    const merged: Record<string, unknown> = {
        ...(base as unknown as Record<string, unknown>),
    };
    for (const field of fields) {
        const localFieldTime = local.fieldUpdatedAt?.[field] ?? localTime;
        const remoteFieldTime = remote.fieldUpdatedAt?.[field] ?? remoteTime;
        if (localFieldTime > remoteFieldTime) {
            merged[field] = (local as unknown as Record<string, unknown>)[field];
        } else if (remoteFieldTime > localFieldTime) {
            merged[field] = (remote as unknown as Record<string, unknown>)[field];
        }
    }
    merged.updatedAt = Math.max(localTime, remoteTime);
    const fieldUpdatedAt = mergeFieldMaps(
        local.fieldUpdatedAt,
        remote.fieldUpdatedAt,
    );
    if (fieldUpdatedAt) {
        merged.fieldUpdatedAt = fieldUpdatedAt;
    } else {
        delete merged.fieldUpdatedAt;
    }
    return merged as T;
}

function mergeRecords<T extends MergeableRecord>(
    local: T[],
    remote: T[],
    fields: string[],
): T[] {
    const map = new Map<string, T>();
    for (const item of local) {
        map.set(item.id, item);
    }
    for (const item of remote) {
        const current = map.get(item.id);
        map.set(
            item.id,
            current ? mergeRecord(current, item, fields) : item,
        );
    }
    return [...map.values()];
}

const ENTRY_MERGE_FIELDS = [
    "categoryId",
    "memberId",
    "tagIds",
    "attachmentIds",
    "note",
    "location",
    "originalAmount",
    "recurringId",
];

const BILL_MERGE_FIELDS = [
    "title",
    "dueDate",
    "note",
    "categoryId",
    "memberId",
    "tagIds",
    "attachmentIds",
];

const MEMBER_MERGE_FIELDS = [
    "name",
    "color",
    "pinHash",
    "pinSalt",
    "pinIterations",
];

function memberHasPin(member: Member): boolean {
    return Boolean(
        member.pinHash && member.pinSalt && member.pinIterations,
    );
}

function memberPinTime(member: Member): number {
    const fieldTimes = ["pinHash", "pinSalt", "pinIterations"]
        .map((field) => member.fieldUpdatedAt?.[field] ?? 0)
        .filter((time) => time > 0);
    return fieldTimes.length > 0
        ? Math.max(...fieldTimes)
        : recordTime(member);
}

function memberPinFields(
    member: Member,
): Pick<Member, "pinHash" | "pinSalt" | "pinIterations"> {
    return {
        pinHash: member.pinHash,
        pinSalt: member.pinSalt,
        pinIterations: member.pinIterations,
    };
}

function samePin(local: Member, remote: Member): boolean {
    return (
        local.pinHash === remote.pinHash &&
        local.pinSalt === remote.pinSalt &&
        local.pinIterations === remote.pinIterations
    );
}

function withAtomicPin(
    merged: Member,
    source: Member,
    pinTime: number,
): Member {
    return {
        ...merged,
        ...memberPinFields(source),
        fieldUpdatedAt: {
            ...merged.fieldUpdatedAt,
            pinHash: pinTime,
            pinSalt: pinTime,
            pinIterations: pinTime,
        },
    };
}

function mergeMember(local: Member, remote: Member): Member {
    const merged = mergeRecord(local, remote, MEMBER_MERGE_FIELDS);
    const localHasPin = memberHasPin(local);
    const remoteHasPin = memberHasPin(remote);
    if (!localHasPin && !remoteHasPin) {
        return merged;
    }
    if (localHasPin && !remoteHasPin) {
        return withAtomicPin(merged, local, memberPinTime(local));
    }
    if (!localHasPin && remoteHasPin) {
        return withAtomicPin(merged, remote, memberPinTime(remote));
    }

    // Password hash, salt and iteration count must move as one unit. Merging
    // them field-by-field can combine a new hash with an old salt, which makes
    // every login fail even though the password was never changed by the user.
    const localPinTime = memberPinTime(local);
    const remotePinTime = memberPinTime(remote);
    if (localPinTime > remotePinTime) {
        return withAtomicPin(merged, local, localPinTime);
    }
    if (remotePinTime > localPinTime) {
        return withAtomicPin(merged, remote, remotePinTime);
    }
    if (!samePin(local, remote)) {
        const chooseLocal = recordTime(local) > recordTime(remote);
        return withAtomicPin(
            merged,
            chooseLocal ? local : remote,
            Math.max(localPinTime, remotePinTime),
        );
    }
    return merged;
}

function mergeMembers(local: Member[], remote: Member[]): Member[] {
    const map = new Map<string, Member>();
    for (const member of local) {
        map.set(member.id, member);
    }
    for (const member of remote) {
        const current = map.get(member.id);
        map.set(member.id, current ? mergeMember(current, member) : member);
    }
    return [...map.values()];
}

function mergeConfig<T extends { id: string }>(local: T[], remote: T[]): T[] {
    const map = new Map<string, T>();
    for (const item of local) {
        map.set(item.id, item);
    }
    for (const item of remote) {
        map.set(item.id, item);
    }
    return [...map.values()];
}

function mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
    const map = new Map<string, Tombstone>();
    for (const item of [...local, ...remote]) {
        const current = map.get(item.id);
        if (!current || item.deletedAt >= current.deletedAt) {
            map.set(item.id, item);
        }
    }
    return [...map.values()].sort((a, b) => b.deletedAt - a.deletedAt);
}

function applyTombstones<T extends { id: string }>(
    items: T[],
    tombstones: Tombstone[],
    time: (item: T) => number,
): T[] {
    const deleted = new Map(tombstones.map((item) => [item.id, item.deletedAt]));
    return items.filter((item) => {
        const deletedAt = deleted.get(item.id);
        return deletedAt === undefined || deletedAt < time(item);
    });
}

export function mergeBooks(local: Book, remote: Book): Book {
    const deletedEntries = mergeTombstones(
        local.deletedEntries ?? [],
        remote.deletedEntries ?? [],
    );
    const deletedBills = mergeTombstones(
        local.deletedBills ?? [],
        remote.deletedBills ?? [],
    );
    const deletedConfig = mergeTombstones(
        local.deletedConfig ?? [],
        remote.deletedConfig ?? [],
    );
    const entries = applyTombstones(
        mergeRecords(local.entries, remote.entries, ENTRY_MERGE_FIELDS),
        deletedEntries,
        recordTime,
    );
    const bills = applyTombstones(
        mergeRecords(local.bills, remote.bills, BILL_MERGE_FIELDS),
        deletedBills,
        recordTime,
    );
    const config = <T extends { id: string; createdAt?: number; updatedAt?: number }>(
        localItems: T[],
        remoteItems: T[],
    ) =>
        applyTombstones(
            mergeConfig(localItems, remoteItems),
            deletedConfig,
            recordTime,
        );

    return {
        id: remote.id,
        name: remote.name || local.name,
        createdAt: Math.min(local.createdAt, remote.createdAt),
        updatedAt: Math.max(local.updatedAt, remote.updatedAt),
        accounts: config(local.accounts, remote.accounts),
        categories: config(local.categories, remote.categories),
        members: applyTombstones(
            mergeMembers(local.members, remote.members),
            deletedConfig,
            recordTime,
        ),
        tagGroups: config(local.tagGroups, remote.tagGroups),
        tags: config(local.tags, remote.tags),
        budgets: config(local.budgets, remote.budgets),
        recurringRules: config(local.recurringRules, remote.recurringRules),
        attachments: config(local.attachments, remote.attachments),
        deletedEntries,
        deletedBills,
        deletedConfig,
        bills,
        entries,
        settings: remote.settings,
        remote: local.remote,
    };
}

function sortedById<T extends { id: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Stable content signature used to decide whether the merged book really
 * differs from the remote copy. Ignores sync metadata.
 */
export function bookContentSignature(book: Book): string {
    return JSON.stringify({
        id: book.id,
        name: book.name,
        createdAt: book.createdAt,
        accounts: sortedById(book.accounts),
        categories: sortedById(book.categories),
        members: sortedById(book.members),
        tagGroups: sortedById(book.tagGroups),
        tags: sortedById(book.tags),
        budgets: sortedById(book.budgets),
        recurringRules: sortedById(book.recurringRules),
        attachments: sortedById(book.attachments),
        deletedEntries: sortedById(book.deletedEntries),
        deletedBills: sortedById(book.deletedBills),
        deletedConfig: sortedById(book.deletedConfig),
        bills: sortedById(book.bills),
        entries: sortedById(book.entries),
        settings: book.settings,
    });
}

/** Reassigns fallback local identities after a provider user is resolved. */
export function reassignOwner(
    book: Book,
    fromId: string,
    actor: Actor,
): Book {
    const at = Date.now();
    const reassign = <
        T extends {
            ownerId?: string;
            ownerName?: string;
            updatedAt?: number;
            createdAt?: number;
        },
    >(
        item: T,
    ): T =>
        item.ownerId === fromId
            ? {
                  ...item,
                  ownerId: actor.id,
                  ownerName: actor.name,
                  updatedAt: item.updatedAt ?? item.createdAt ?? at,
              }
            : item;
    return {
        ...book,
        entries: book.entries.map(reassign),
        bills: book.bills.map(reassign),
        recurringRules: book.recurringRules.map((rule) => reassign(rule)),
        attachments: book.attachments.map(reassign),
    };
}

/** Claims legacy unowned records for the first user who connects a repo. */
export function claimUnownedRecords(book: Book, actor: Actor): Book {
    const at = Date.now();
    const claim = <T extends { ownerId?: string; ownerName?: string; updatedAt?: number; createdAt?: number }>(
        item: T,
    ): T =>
        item.ownerId
            ? item
            : {
                  ...item,
                  ownerId: actor.id,
                  ownerName: actor.name,
                  updatedAt: item.updatedAt ?? item.createdAt ?? at,
              };
    return {
        ...book,
        entries: book.entries.map(claim),
        bills: book.bills.map(claim),
        recurringRules: book.recurringRules.map((rule: RecurringRule) => claim(rule)),
        attachments: book.attachments.map(claim),
    };
}

export function entryOwnerLabel(entry: Entry | Bill): string | undefined {
    return entry.ownerName;
}
