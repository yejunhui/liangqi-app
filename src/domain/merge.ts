/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Per-record merge for the shared-repository mode. Entries and bills are the
 * conflict unit: additions from different users are unioned, and the newest
 * update wins for the same id. Shared configuration is unioned by id with the
 * remote copy winning duplicates.
 */

import type {
    Bill,
    Book,
    Entry,
    RecurringRule,
    RemoteUser,
    Tombstone,
} from "@/types";

function recordTime(record: {
    updatedAt?: number;
    createdAt?: number;
}): number {
    return record.updatedAt ?? record.createdAt ?? 0;
}

function mergeById<T extends { id: string }>(
    local: T[],
    remote: T[],
    time: (item: T) => number,
): T[] {
    const map = new Map<string, T>();
    for (const item of local) {
        map.set(item.id, item);
    }
    for (const item of remote) {
        const current = map.get(item.id);
        if (!current || time(item) >= time(current)) {
            map.set(item.id, item);
        }
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
    const entries = applyTombstones(
        mergeById(local.entries, remote.entries, recordTime),
        deletedEntries,
        recordTime,
    );
    const bills = applyTombstones(
        mergeById(local.bills, remote.bills, recordTime),
        deletedBills,
        recordTime,
    );

    return {
        id: remote.id,
        name: remote.name || local.name,
        createdAt: Math.min(local.createdAt, remote.createdAt),
        updatedAt: Math.max(local.updatedAt, remote.updatedAt),
        accounts: mergeConfig(local.accounts, remote.accounts),
        categories: mergeConfig(local.categories, remote.categories),
        members: mergeConfig(local.members, remote.members),
        tagGroups: mergeConfig(local.tagGroups, remote.tagGroups),
        tags: mergeConfig(local.tags, remote.tags),
        budgets: mergeConfig(local.budgets, remote.budgets),
        recurringRules: mergeById(
            local.recurringRules,
            remote.recurringRules,
            recordTime,
        ),
        attachments: mergeConfig(local.attachments, remote.attachments),
        deletedEntries,
        deletedBills,
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
        bills: sortedById(book.bills),
        entries: sortedById(book.entries),
        settings: book.settings,
    });
}

/** Reassigns fallback local identities after a provider user is resolved. */
export function reassignOwner(
    book: Book,
    fromId: string,
    actor: RemoteUser,
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
export function claimUnownedRecords(book: Book, actor: RemoteUser): Book {
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
