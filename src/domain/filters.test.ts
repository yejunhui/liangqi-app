/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Category, Entry } from "@/types";
import { filterEntries } from "@/domain/filters";

const NOW = new Date(2026, 9, 31, 12).getTime();

const categories: Category[] = [
    {
        id: "cat_food",
        name: "餐饮",
        kind: "expense",
        emoji: "🍜",
        color: "#e07a5f",
        createdAt: NOW,
    },
    {
        id: "cat_lunch",
        name: "午餐",
        kind: "expense",
        emoji: "🍱",
        color: "#e07a5f",
        parent: "cat_food",
        createdAt: NOW,
    },
];

function entry(overrides: Partial<Entry> = {}): Entry {
    return {
        id: "entry_1",
        kind: "expense",
        amount: 3500,
        date: NOW,
        accountId: "acc_cash",
        categoryId: "cat_lunch",
        memberId: "member_me",
        tagIds: ["tag_trip"],
        note: "午饭",
        createdAt: NOW,
        ...overrides,
    };
}

describe("entry filters", () => {
    it("includes child categories when filtering a parent", () => {
        expect(
            filterEntries([entry()], { categoryId: "cat_food" }, categories),
        ).toHaveLength(1);
    });

    it("filters by tag, member, account, date and amount", () => {
        const entries = [entry(), entry({ id: "entry_2", amount: 1000 })];
        expect(
            filterEntries(
                entries,
                {
                    tagId: "tag_trip",
                    memberId: "member_me",
                    accountId: "acc_cash",
                    start: NOW - 1000,
                    end: NOW + 1000,
                    minAmount: 2000,
                },
                categories,
            ),
        ).toHaveLength(1);
    });

    it("matches keyword against note and category", () => {
        expect(
            filterEntries([entry()], { keyword: "午饭" }, categories),
        ).toHaveLength(1);
        expect(
            filterEntries([entry()], { keyword: "餐饮" }, categories),
        ).toHaveLength(1);
        expect(
            filterEntries([entry()], { keyword: "打车" }, categories),
        ).toHaveLength(0);
    });
});
