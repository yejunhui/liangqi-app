/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Budget, Category, Entry } from "@/types";
import { createSeedData } from "@/domain/seed";
import { getBudgetProgress, getBudgetSpent } from "@/domain/budgets";

const NOW = new Date(2026, 9, 31, 12).getTime();

function fixture() {
    const seed = createSeedData(NOW);
    const lunch: Category = {
        id: "cat_lunch",
        name: "午餐",
        kind: "expense",
        emoji: "🍱",
        color: "#e07a5f",
        parent: "cat_food",
        createdAt: NOW,
    };
    seed.categories.push(lunch);
    seed.tags = [
        { id: "tag_trip", name: "旅行", color: "#3d8bfd", createdAt: NOW },
    ];
    const entries: Entry[] = [
        {
            id: "e_food",
            kind: "expense",
            amount: 12000,
            date: NOW,
            accountId: "acc_bank",
            categoryId: "cat_food",
            memberId: "member_me",
            tagIds: ["tag_trip"],
            createdAt: NOW,
        },
        {
            id: "e_lunch",
            kind: "expense",
            amount: 8000,
            date: NOW,
            accountId: "acc_bank",
            categoryId: "cat_lunch",
            memberId: "member_me",
            createdAt: NOW,
        },
        {
            id: "e_income",
            kind: "income",
            amount: 50000,
            date: NOW,
            accountId: "acc_bank",
            categoryId: "cat_salary",
            memberId: "member_me",
            createdAt: NOW,
        },
        {
            id: "e_old",
            kind: "expense",
            amount: 99999,
            date: new Date(2025, 9, 31, 12).getTime(),
            accountId: "acc_bank",
            categoryId: "cat_food",
            createdAt: NOW,
        },
    ];
    return { ...seed, entries };
}

function budget(overrides: Partial<Budget> = {}): Budget {
    return {
        id: "b1",
        name: "餐饮预算",
        period: "month",
        amount: 50000,
        categoryIds: ["cat_food"],
        tagIds: [],
        memberIds: [],
        createdAt: NOW,
        ...overrides,
    };
}

describe("budgets", () => {
    it("counts an expense and its child category", () => {
        const data = fixture();
        expect(getBudgetSpent(budget(), data.entries, data.categories, NOW)).toBe(20000);
    });

    it("filters by tag and ignores income", () => {
        const data = fixture();
        const tagged = budget({ categoryIds: [], tagIds: ["tag_trip"] });
        expect(getBudgetSpent(tagged, data.entries, data.categories, NOW)).toBe(12000);
    });

    it("filters by member", () => {
        const data = fixture();
        const other = budget({ categoryIds: [], memberIds: ["missing"] });
        expect(getBudgetSpent(other, data.entries, data.categories, NOW)).toBe(0);
    });

    it("uses year periods", () => {
        const data = fixture();
        const yearly = budget({ period: "year", amount: 100000, categoryIds: [] });
        expect(getBudgetSpent(yearly, data.entries, data.categories, NOW)).toBe(20000);
        const progress = getBudgetProgress(yearly, data.entries, data.categories, NOW);
        expect(progress.remaining).toBe(80000);
        expect(progress.periodLabel).toBe("年度");
    });
});
