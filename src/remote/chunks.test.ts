/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Bill, Entry } from "@/types";
import { createSeedBook } from "@/domain/seed";
import {
    CHUNK_SIZE,
    buildRemotePayload,
    bookFromParts,
    parseManifest,
    parseMetaFile,
} from "@/remote/chunks";

const NOW = new Date(2026, 9, 31, 12).getTime();

function buildBook() {
    const book = createSeedBook("大账本", NOW);
    book.entries = Array.from({ length: 2505 }, (_, index): Entry => ({
        id: `entry_${index}`,
        kind: "expense",
        amount: 100 + index,
        date: NOW - index * 1000,
        accountId: "acc_cash",
        categoryId: "cat_food",
        memberId: "member_me",
        note: `第 ${index} 笔`,
        createdAt: NOW - index * 1000,
    }));
    book.bills = Array.from({ length: 1201 }, (_, index): Bill => ({
        id: `bill_${index}`,
        liabilityAccountId: "acc_credit",
        categoryId: "cat_food",
        memberId: "member_me",
        title: `账单 ${index}`,
        principal: 1000 + index,
        purchasedAt: NOW - index * 1000,
        createdAt: NOW - index * 1000,
    }));
    book.tagGroups = [
        { id: "tag_group_trip", name: "出行", selection: "multiple", createdAt: NOW },
    ];
    book.tags = [
        {
            id: "tag_trip",
            name: "旅行",
            color: "#3d8bfd",
            groupId: "tag_group_trip",
            createdAt: NOW,
        },
    ];
    book.budgets = [
        {
            id: "budget_food",
            name: "餐饮预算",
            period: "month",
            amount: 100_000,
            categoryIds: ["cat_food"],
            tagIds: ["tag_trip"],
            memberIds: ["member_me"],
            createdAt: NOW,
        },
    ];
    book.bills[0].tagIds = ["tag_trip"];
    book.entries[0].tagIds = ["tag_trip"];
    return book;
}

describe("remote chunks", () => {
    it("splits entries and bills into fixed-size chunks", async () => {
        const book = buildBook();
        const payload = await buildRemotePayload(book);

        expect(payload.entries).toHaveLength(Math.ceil(2505 / CHUNK_SIZE));
        expect(payload.bills).toHaveLength(Math.ceil(1201 / CHUNK_SIZE));
        expect(payload.entries[0].ref.count).toBe(1000);
        expect(payload.entries[1].ref.start).toBe(1000);
        expect(payload.entries[2].ref.count).toBe(505);
        expect(payload.bills[1].ref.count).toBe(201);
        expect(payload.manifest.entryCount).toBe(2505);
        expect(payload.manifest.billCount).toBe(1201);

        const manifest = parseManifest(JSON.stringify(payload.manifest));
        expect(manifest.chunks.entries).toHaveLength(3);
        expect(manifest.metaHash).toBe(payload.metaHash);

        const meta = parseMetaFile(payload.metaText);
        const entries = payload.entries.flatMap((chunk) =>
            JSON.parse(chunk.text) as Entry[],
        );
        const bills = payload.bills.flatMap((chunk) => JSON.parse(chunk.text) as Bill[]);
        const rebuilt = bookFromParts(meta, entries, bills);
        expect(rebuilt.entries).toHaveLength(2505);
        expect(rebuilt.bills).toHaveLength(1201);
        expect(rebuilt.members[0].name).toBe("我");
        expect(rebuilt.tags[0].groupId).toBe("tag_group_trip");
        expect(rebuilt.budgets[0].categoryIds).toEqual(["cat_food"]);
        expect(rebuilt.entries[0].tagIds).toEqual(["tag_trip"]);
    });

    it("produces stable hashes for identical content", async () => {
        const book = buildBook();
        const first = await buildRemotePayload(book);
        const second = await buildRemotePayload(book);
        expect(first.metaHash).toBe(second.metaHash);
        expect(first.manifest.chunks.entries[0].hash).toBe(
            second.manifest.chunks.entries[0].hash,
        );
    });

    it("rejects an unsupported manifest version", () => {
        expect(() =>
            parseManifest(
                JSON.stringify({ app: "liangqi", version: 1, chunks: {} }),
            ),
        ).toThrow();
    });
});
