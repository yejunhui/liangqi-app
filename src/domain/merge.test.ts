/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Entry } from "@/types";
import { createSeedBook } from "@/domain/seed";
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

describe("multi-user merge", () => {
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
        local.tags.push({
            id: "tag_local",
            name: "本地标签",
            color: "#0f766e",
            createdAt: NOW,
        });
        const remote = createSeedBook("共享账", NOW);
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
