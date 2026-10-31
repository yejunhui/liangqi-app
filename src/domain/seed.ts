/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Account, Book, Category, LedgerData } from "@/types";
import { newId } from "@/utils/id";
import { createDefaultMember } from "@/domain/members";

const CATEGORY_COLORS = {
    food: "#e07a5f",
    transport: "#3d8bfd",
    shopping: "#c084fc",
    home: "#f2b84b",
    fun: "#2dd4bf",
    health: "#fb7185",
    study: "#60a5fa",
    other: "#a8a29e",
    salary: "#10b981",
    bonus: "#f59e0b",
    invest: "#14b8a6",
    otherIncome: "#94a3b8",
} as const;

export function createSeedData(now = Date.now()): LedgerData {
    const accounts: Account[] = [
        {
            id: "acc_cash",
            name: "现金",
            kind: "asset",
            emoji: "💵",
            openingBalance: 0,
            note: "口袋里的现金",
            createdAt: now,
        },
        {
            id: "acc_bank",
            name: "银行卡",
            kind: "asset",
            emoji: "🏦",
            openingBalance: 0,
            note: "储蓄卡 / 活期",
            createdAt: now,
        },
        {
            id: "acc_credit",
            name: "信用卡",
            kind: "liability",
            emoji: "💳",
            openingBalance: 0,
            note: "先消费，后还款",
            createdAt: now,
        },
    ];

    const categories: Category[] = [
        {
            id: "cat_food",
            name: "餐饮",
            kind: "expense",
            emoji: "🍜",
            color: CATEGORY_COLORS.food,
            createdAt: now,
        },
        {
            id: "cat_transport",
            name: "交通",
            kind: "expense",
            emoji: "🚇",
            color: CATEGORY_COLORS.transport,
            createdAt: now,
        },
        {
            id: "cat_shopping",
            name: "购物",
            kind: "expense",
            emoji: "🛍️",
            color: CATEGORY_COLORS.shopping,
            createdAt: now,
        },
        {
            id: "cat_home",
            name: "居住",
            kind: "expense",
            emoji: "🏠",
            color: CATEGORY_COLORS.home,
            createdAt: now,
        },
        {
            id: "cat_fun",
            name: "娱乐",
            kind: "expense",
            emoji: "🎮",
            color: CATEGORY_COLORS.fun,
            createdAt: now,
        },
        {
            id: "cat_health",
            name: "医疗",
            kind: "expense",
            emoji: "💊",
            color: CATEGORY_COLORS.health,
            createdAt: now,
        },
        {
            id: "cat_study",
            name: "学习",
            kind: "expense",
            emoji: "📚",
            color: CATEGORY_COLORS.study,
            createdAt: now,
        },
        {
            id: "cat_other",
            name: "其他",
            kind: "expense",
            emoji: "📦",
            color: CATEGORY_COLORS.other,
            createdAt: now,
        },
        {
            id: "cat_salary",
            name: "工资",
            kind: "income",
            emoji: "💰",
            color: CATEGORY_COLORS.salary,
            createdAt: now,
        },
        {
            id: "cat_bonus",
            name: "奖金",
            kind: "income",
            emoji: "🎁",
            color: CATEGORY_COLORS.bonus,
            createdAt: now,
        },
        {
            id: "cat_invest",
            name: "理财",
            kind: "income",
            emoji: "📈",
            color: CATEGORY_COLORS.invest,
            createdAt: now,
        },
        {
            id: "cat_other_income",
            name: "其他收入",
            kind: "income",
            emoji: "✨",
            color: CATEGORY_COLORS.otherIncome,
            createdAt: now,
        },
    ];

    return {
        accounts,
        categories,
        members: [createDefaultMember(now)],
        tagGroups: [],
        tags: [],
        budgets: [],
        recurringRules: [],
        attachments: [],
        deletedEntries: [],
        deletedBills: [],
        bills: [],
        entries: [],
        settings: {
            currency: "CNY",
            theme: "system",
        },
    };
}

export function createSeedBook(name = "我的账本", now = Date.now()): Book {
    return {
        id: newId("book"),
        name,
        createdAt: now,
        updatedAt: now,
        ...createSeedData(now),
    };
}
