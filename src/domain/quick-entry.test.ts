/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Account, Category } from "@/types";
import { parseQuickEntry } from "@/domain/quick-entry";

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
        id: "cat_taxi",
        name: "打车",
        kind: "expense",
        emoji: "🚕",
        color: "#f2b84b",
        createdAt: NOW,
    },
    {
        id: "cat_salary",
        name: "工资",
        kind: "income",
        emoji: "💰",
        color: "#10b981",
        createdAt: NOW,
    },
];

const accounts: Account[] = [
    {
        id: "acc_cash",
        name: "现金",
        kind: "asset",
        emoji: "💵",
        openingBalance: 0,
        createdAt: NOW,
    },
    {
        id: "acc_bank",
        name: "银行卡",
        kind: "asset",
        emoji: "🏦",
        openingBalance: 0,
        createdAt: NOW,
    },
    {
        id: "acc_credit",
        name: "信用卡",
        kind: "liability",
        emoji: "💳",
        openingBalance: 0,
        createdAt: NOW,
    },
    {
        id: "acc_loan",
        name: "装修贷",
        kind: "liability",
        emoji: "🧾",
        openingBalance: 0,
        createdAt: NOW,
    },
];

function parse(text: string) {
    return parseQuickEntry({ text, categories, accounts, now: NOW });
}

describe("quick entry parsing", () => {
    it("parses an expense amount and category", () => {
        const result = parse("昨天午饭 35 元 现金");
        expect(result.ok).toBe(true);
        expect(result.suggestion).toMatchObject({
            kind: "expense",
            paymentMode: "asset",
            amount: 3500,
            categoryId: "cat_food",
            accountId: "acc_cash",
        });
        expect(new Date(result.suggestion!.date).getDate()).toBe(30);
    });

    it("parses income and liability", () => {
        expect(parse("工资 8000 银行卡").suggestion).toMatchObject({
            kind: "income",
            amount: 800_000,
            categoryId: "cat_salary",
            accountId: "acc_bank",
        });
        expect(parse("信用卡 打车 28.5").suggestion).toMatchObject({
            kind: "expense",
            paymentMode: "liability",
            amount: 2850,
            categoryId: "cat_taxi",
            liabilityAccountId: "acc_credit",
        });
    });

    it("selects a liability account by its kind, not only credit-card keywords", () => {
        expect(parse("装修贷 午饭 35").suggestion).toMatchObject({
            kind: "expense",
            paymentMode: "liability",
            amount: 3500,
            liabilityAccountId: "acc_loan",
        });
    });

    it("takes the last amount and ignores date numbers", () => {
        expect(parse("10月31日 午饭 35").suggestion?.amount).toBe(3500);
        expect(parse("午饭 35 10月31日").suggestion?.amount).toBe(3500);
        expect(parse("¥1,280.50 房租").suggestion?.amount).toBe(128_050);
        expect(parse("1,280.50 房租").suggestion?.amount).toBe(128_050);
    });

    it("reports missing amounts", () => {
        expect(parse("午饭").ok).toBe(false);
        expect(parse("").error).toBeTruthy();
    });
});
