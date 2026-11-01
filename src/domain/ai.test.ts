/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account, Category } from "@/types";
import { parseQuickEntryWithAi } from "@/domain/ai";

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

function mockResponse(content: unknown, status = 200) {
    return vi.fn(async () =>
        new Response(
            JSON.stringify({
                choices: [{ message: { content: JSON.stringify(content) } }],
            }),
            { status },
        ),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("AI quick entry", () => {
    it("maps AI output to categories and accounts", async () => {
        vi.stubGlobal(
            "fetch",
            mockResponse({
                amount: 32.5,
                kind: "expense",
                paymentMode: "liability",
                categoryName: "餐饮",
                accountName: "信用卡",
                date: "2026-10-30",
                note: "午饭",
            }),
        );
        const result = await parseQuickEntryWithAi({
            text: "昨天信用卡午饭 32.5",
            categories,
            accounts,
            config: {
                endpoint: "https://example.com/v1",
                model: "test-model",
                apiKey: "test-key",
            },
            now: NOW,
        });
        expect(result).toMatchObject({
            kind: "expense",
            paymentMode: "liability",
            amount: 3250,
            categoryId: "cat_food",
            liabilityAccountId: "acc_credit",
        });
        expect(new Date(result.date).getDate()).toBe(30);
    });

    it("uses the matched liability account even if AI says asset", async () => {
        vi.stubGlobal(
            "fetch",
            mockResponse({
                amount: 88,
                kind: "expense",
                paymentMode: "asset",
                categoryName: "餐饮",
                accountName: "装修贷",
                date: "2026-10-31",
                note: "装修贷午饭",
            }),
        );
        const result = await parseQuickEntryWithAi({
            text: "装修贷午饭 88",
            categories,
            accounts,
            config: { endpoint: "https://example.com", model: "m", apiKey: "k" },
            now: NOW,
        });
        expect(result).toMatchObject({
            kind: "expense",
            paymentMode: "liability",
            liabilityAccountId: "acc_loan",
        });
        expect(result.accountId).toBeUndefined();
    });

    it("uses defaults for unknown category and account", async () => {
        vi.stubGlobal(
            "fetch",
            mockResponse({
                amount: 100,
                kind: "income",
                paymentMode: "asset",
                categoryName: "不存在",
                accountName: "不存在",
                date: "2026-10-31",
            }),
        );
        const result = await parseQuickEntryWithAi({
            text: "收到一百块",
            categories,
            accounts,
            config: { endpoint: "https://example.com", model: "m", apiKey: "k" },
            now: NOW,
        });
        expect(result.kind).toBe("income");
        expect(result.categoryId).toBeUndefined();
        expect(result.accountId).toBeUndefined();
        expect(result.note).toBe("收到一百块");
    });

    it("surfaces API errors", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(
                    JSON.stringify({ error: { message: "invalid key" } }),
                    { status: 401 },
                ),
            ),
        );
        await expect(
            parseQuickEntryWithAi({
                text: "午饭 20",
                categories,
                accounts,
                config: { endpoint: "https://example.com", model: "m", apiKey: "k" },
                now: NOW,
            }),
        ).rejects.toThrow("invalid key");
    });
});
