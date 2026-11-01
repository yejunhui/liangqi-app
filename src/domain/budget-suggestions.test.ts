/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Entry } from "@/types";
import { createSeedData } from "@/domain/seed";
import { suggestBudgets } from "@/domain/budget-suggestions";

const NOW = new Date(2026, 9, 31, 12).getTime();

function expense(month: number, amount: number): Entry {
    return {
        id: `entry_${month}_${amount}`,
        kind: "expense",
        amount,
        date: new Date(2026, month, 15, 12).getTime(),
        accountId: "acc_cash",
        categoryId: "cat_food",
        createdAt: NOW,
    };
}

describe("budget suggestions", () => {
    it("averages the last three complete months and rounds up", () => {
        const data = createSeedData(NOW);
        const entries = [
            expense(6, 30_000),
            expense(7, 60_000),
            expense(8, 90_000),
            expense(9, 999_999),
        ];
        const suggestions = suggestBudgets(entries, data.categories, [], NOW);
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].categoryId).toBe("cat_food");
        expect(suggestions[0].average).toBe(60_000);
        expect(suggestions[0].amount).toBe(60_000);
    });

    it("skips categories that already have budgets", () => {
        const data = createSeedData(NOW);
        const suggestions = suggestBudgets(
            [expense(7, 10_000)],
            data.categories,
            [
                {
                    id: "budget_food",
                    name: "餐饮",
                    period: "month",
                    amount: 20_000,
                    categoryIds: ["cat_food"],
                    tagIds: [],
                    memberIds: [],
                    createdAt: NOW,
                },
            ],
            NOW,
        );
        expect(suggestions).toHaveLength(0);
    });
});
