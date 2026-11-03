/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Entry, Member } from "@/types";
import { createSeedBook } from "@/domain/seed";
import { hashMemberPin, verifyMemberPin } from "@/domain/member-pin";
import {
    bookContentSignature,
    claimUnownedRecords,
    mergeBooks,
} from "@/domain/merge";

const NOW = new Date(2026, 9, 31, 12).getTime();

function entry(id: string, ownerId: string, updatedAt: number): Entry {
    return {
        id,
        kind: "expense",
        amount: 1000,
        date: NOW,
        accountId: "acc_cash",
        categoryId: "cat_food",
        ownerId,
        ownerName: ownerId,
        updatedAt,
        createdAt: NOW,
    };
}

function member(overrides: Partial<Member> = {}): Member {
    return {
        id: "member_shared",
        name: "Alice",
        color: "#0f766e",
        createdAt: NOW,
        ...overrides,
    };
}

describe("multi-user merge", () => {
    it("merges the newer member password hash", () => {
        const local = createSeedBook("共享账", NOW);
        local.members = [
            member({
                pinHash: "old-hash",
                pinSalt: "old-salt",
                pinIterations: 160_000,
                updatedAt: 100,
            }),
        ];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [
            member({
                pinHash: "new-hash",
                pinSalt: "new-salt",
                pinIterations: 160_000,
                updatedAt: 200,
            }),
        ];

        const merged = mergeBooks(local, remote);
        expect(merged.members[0]).toMatchObject({
            pinHash: "new-hash",
            pinSalt: "new-salt",
        });
    });

    it("does not let a later name change make an old password win", () => {
        const local = createSeedBook("共享账", NOW);
        local.members = [
            member({
                pinHash: "new-hash",
                pinSalt: "new-salt",
                pinIterations: 160_000,
                updatedAt: 200,
                fieldUpdatedAt: {
                    pinHash: 200,
                    pinSalt: 200,
                    pinIterations: 200,
                },
            }),
        ];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [
            member({
                name: "Alice Renamed",
                pinHash: "old-hash",
                pinSalt: "old-salt",
                pinIterations: 160_000,
                // The name was changed after the password, but the PIN
                // fields themselves are older.
                updatedAt: 300,
                fieldUpdatedAt: {
                    name: 300,
                    pinHash: 100,
                    pinSalt: 100,
                    pinIterations: 100,
                },
            }),
        ];

        const merged = mergeBooks(local, remote);
        expect(merged.members[0]).toMatchObject({
            name: "Alice Renamed",
            pinHash: "new-hash",
            pinSalt: "new-salt",
            pinIterations: 160_000,
        });
    });

    it("merges password hash, salt, and iterations as one unit", () => {
        const local = createSeedBook("共享账", NOW);
        local.members = [
            member({
                pinHash: "local-hash",
                pinSalt: "local-salt",
                pinIterations: 160_000,
                updatedAt: 300,
                fieldUpdatedAt: {
                    pinHash: 300,
                    pinSalt: 100,
                    pinIterations: 100,
                },
            }),
        ];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [
            member({
                pinHash: "remote-hash",
                pinSalt: "remote-salt",
                pinIterations: 160_000,
                updatedAt: 200,
                fieldUpdatedAt: {
                    pinHash: 100,
                    pinSalt: 200,
                    pinIterations: 200,
                },
            }),
        ];

        const merged = mergeBooks(local, remote);
        expect(merged.members[0]).toMatchObject({
            pinHash: "local-hash",
            pinSalt: "local-salt",
            pinIterations: 160_000,
        });
        expect(merged.members[0].fieldUpdatedAt).toMatchObject({
            pinHash: 300,
            pinSalt: 300,
            pinIterations: 300,
        });
    });

    it("does not let a passwordless member overwrite a local password", () => {
        const local = createSeedBook("共享账", NOW);
        local.members = [
            member({
                pinHash: "local-hash",
                pinSalt: "local-salt",
                pinIterations: 160_000,
                updatedAt: 100,
            }),
        ];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [member({ updatedAt: 200 })];

        const merged = mergeBooks(local, remote);
        expect(merged.members[0]).toMatchObject({
            pinHash: "local-hash",
            pinSalt: "local-salt",
            pinIterations: 160_000,
        });
    });

    it("keeps a password from either side over a passwordless copy", () => {
        const local = createSeedBook("共享账", NOW);
        local.members = [member({ updatedAt: 200 })];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [
            member({
                pinHash: "remote-hash",
                pinSalt: "remote-salt",
                pinIterations: 160_000,
                updatedAt: 100,
            }),
        ];

        const merged = mergeBooks(local, remote);
        expect(merged.members[0]).toMatchObject({
            pinHash: "remote-hash",
            pinSalt: "remote-salt",
        });
    });

    it("verifies the newer password after a later name change", async () => {
        const newFields = await hashMemberPin("new-password");
        const oldFields = await hashMemberPin("old-password");
        const local = createSeedBook("共享账", NOW);
        local.members = [
            member({
                ...newFields,
                updatedAt: 200,
                fieldUpdatedAt: {
                    pinHash: 200,
                    pinSalt: 200,
                    pinIterations: 200,
                },
            }),
        ];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [
            member({
                ...oldFields,
                name: "Alice Renamed",
                updatedAt: 300,
                fieldUpdatedAt: {
                    name: 300,
                    pinHash: 100,
                    pinSalt: 100,
                    pinIterations: 100,
                },
            }),
        ];

        const merged = mergeBooks(local, remote);
        await expect(
            verifyMemberPin("new-password", merged.members[0]),
        ).resolves.toBe(true);
        await expect(
            verifyMemberPin("old-password", merged.members[0]),
        ).resolves.toBe(false);
    });

    it("verifies the newer password after merging two devices", async () => {
        const localFields = await hashMemberPin("new-password");
        const remoteFields = await hashMemberPin("old-password");
        const local = createSeedBook("共享账", NOW);
        local.members = [member({ ...localFields, updatedAt: 200 })];
        const remote = createSeedBook("共享账", NOW);
        remote.members = [member({ ...remoteFields, updatedAt: 100 })];

        const merged = mergeBooks(local, remote);
        await expect(
            verifyMemberPin("new-password", merged.members[0]),
        ).resolves.toBe(true);
        await expect(
            verifyMemberPin("old-password", merged.members[0]),
        ).resolves.toBe(false);
    });

    it("unions additions from two users and keeps the latest edit", () => {
        const local = createSeedBook("共享账", NOW);
        local.entries = [entry("shared", "alice", 100)];
        const remote = createSeedBook("共享账", NOW);
        remote.entries = [
            { ...entry("shared", "alice", 200), note: "远程更新" },
            entry("bob_entry", "bob", 150),
        ];

        const merged = mergeBooks(local, remote);
        expect(merged.entries).toHaveLength(2);
        expect(merged.entries.find((item) => item.id === "shared")?.note).toBe(
            "远程更新",
        );
        expect(merged.entries.find((item) => item.id === "bob_entry")?.ownerId).toBe(
            "bob",
        );
    });

    it("applies tombstones from either side", () => {
        const local = createSeedBook("共享账", NOW);
        local.entries = [entry("deleted", "alice", 100), entry("kept", "bob", 100)];
        local.deletedEntries = [];
        const remote = createSeedBook("共享账", NOW);
        remote.entries = [];
        remote.deletedEntries = [{ id: "deleted", deletedAt: 200, ownerId: "alice" }];

        const merged = mergeBooks(local, remote);
        expect(merged.entries.map((item) => item.id)).toEqual(["kept"]);
        expect(merged.deletedEntries).toHaveLength(1);
    });

    it("unions shared configuration without dropping local additions", () => {
        const local = createSeedBook("共享账", NOW);
        local.tags = [];
        local.tags.push({
            id: "tag_local",
            name: "本地标签",
            color: "#0f766e",
            createdAt: NOW,
        });
        const remote = createSeedBook("共享账", NOW);
        remote.tags = [];
        remote.tags.push({
            id: "tag_remote",
            name: "远程标签",
            color: "#c2410c",
            createdAt: NOW,
        });

        const merged = mergeBooks(local, remote);
        expect(merged.tags.map((item) => item.id).sort()).toEqual([
            "tag_local",
            "tag_remote",
        ]);
    });

    it("merges changed fields from both sides", () => {
        const local = createSeedBook("共享账", NOW);
        local.entries = [
            {
                ...entry("shared_field", "alice", 200),
                categoryId: "cat_food",
                note: "本地备注",
                fieldUpdatedAt: { note: 200 },
            },
        ];
        const remote = createSeedBook("共享账", NOW);
        remote.id = local.id;
        remote.entries = [
            {
                ...entry("shared_field", "alice", 300),
                categoryId: "cat_transport",
                note: "远程旧备注",
                fieldUpdatedAt: { categoryId: 300, note: 100 },
            },
        ];
        const merged = mergeBooks(local, remote);
        expect(merged.entries[0].categoryId).toBe("cat_transport");
        expect(merged.entries[0].note).toBe("本地备注");
        expect(merged.entries[0].updatedAt).toBe(300);
    });

    it("applies shared configuration tombstones", () => {
        const local = createSeedBook("共享账", NOW);
        local.tags.push({
            id: "tag_deleted",
            name: "要删除的标签",
            color: "#0f766e",
            createdAt: NOW,
        });
        const remote = createSeedBook("共享账", NOW);
        remote.tags = [];
        remote.deletedConfig = [
            { id: "tag_deleted", deletedAt: NOW + 1, ownerId: "alice" },
        ];

        const merged = mergeBooks(local, remote);
        expect(merged.tags.some((item) => item.id === "tag_deleted")).toBe(false);
        expect(merged.deletedConfig).toHaveLength(1);
    });

    it("produces stable signatures independent of array order", () => {
        const local = createSeedBook("共享账", NOW);
        local.entries = [entry("b", "bob", 1), entry("a", "alice", 1)];
        const remote = createSeedBook("共享账", NOW);
        remote.id = local.id;
        remote.entries = [entry("a", "alice", 1), entry("b", "bob", 1)];
        expect(bookContentSignature(local)).toBe(bookContentSignature(remote));
    });

    it("claims legacy unowned records for the connecting user", () => {
        const book = createSeedBook("共享账", NOW);
        const unowned: Entry = {
            id: "legacy",
            kind: "expense",
            amount: 100,
            date: NOW,
            accountId: "acc_cash",
            categoryId: "cat_food",
            createdAt: NOW,
        };
        book.entries = [unowned];
        const claimed = claimUnownedRecords(book, {
            id: "alice",
            name: "Alice",
        });
        expect(claimed.entries[0]).toMatchObject({
            ownerId: "alice",
            ownerName: "Alice",
            updatedAt: NOW,
        });
    });
});
