/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Entry } from "@/types";
import { createSeedData } from "@/domain/seed";
import { buildLedgerContext } from "@/domain/ai-context";

const NOW = new Date(2026, 9, 31, 12).getTime();

describe("AI ledger context", () => {
    it("builds an aggregate snapshot with a bounded recent sample", () => {
        const data = createSeedData(NOW);
        const expense: Entry = {
            id: "entry_food",
            kind: "expense",
            amount: 12_500,
            date: NOW,
            accountId: "acc_cash",
            categoryId: "cat_food",
            memberId: "member_me",
            tagIds: [],
            note: "晚饭",
            location: { lat: 31.23, lng: 121.47, label: "公司" },
            createdAt: NOW,
        };
        data.entries.push(expense);
        data.budgets.push({
            id: "budget_food",
            name: "餐饮预算",
            period: "month",
            amount: 100_000,
            categoryIds: ["cat_food"],
            tagIds: [],
            memberIds: [],
            createdAt: NOW,
        });

        const context = buildLedgerContext({ ...data, name: "家庭账" }, NOW);
        expect(context).toContain("账本：家庭账");
        expect(context).toContain("餐饮");
        expect(context).toContain("餐饮预算");
        expect(context).toContain("最近流水");
        expect(context).not.toContain("31.23");
        expect(context).not.toContain("attachment");
    });

    it("keeps the recent sample at 25 entries", () => {
        const data = createSeedData(NOW);
        for (let index = 0; index < 40; index += 1) {
            data.entries.push({
                id: `entry_${index}`,
                kind: "expense",
                amount: 100 + index,
                date: NOW - index * 1000,
                accountId: "acc_cash",
                categoryId: "cat_food",
                note: `第 ${index} 笔`,
                createdAt: NOW - index * 1000,
            });
        }
        const context = buildLedgerContext({ ...data, name: "大账本" }, NOW);
        expect(context).toContain("最近流水（最多 25 条）");
        expect(context.match(/第 \d+ 笔/g)).toHaveLength(25);
    });
});
