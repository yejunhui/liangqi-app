/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Account, Book, Category, LedgerData } from "@/types";
import { newId } from "@/utils/id";
import { createDefaultMember } from "@/domain/members";
import { createDefaultTagGroups, createDefaultTags } from "@/domain/tags";

import { t } from "@/i18n";

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
            name: t("现金"),
            kind: "asset",
            emoji: "💵",
            openingBalance: 0,
            note: t("口袋里的现金"),
            createdAt: now,
        },
        {
            id: "acc_bank",
            name: t("银行卡"),
            kind: "asset",
            emoji: "🏦",
            openingBalance: 0,
            note: t("储蓄卡 / 活期"),
            createdAt: now,
        },
        {
            id: "acc_credit",
            name: t("信用卡"),
            kind: "liability",
            emoji: "💳",
            openingBalance: 0,
            note: t("先消费，后还款"),
            createdAt: now,
        },
    ];

    const categories: Category[] = [
        {
            id: "cat_food",
            name: t("餐饮"),
            kind: "expense",
            emoji: "🍜",
            color: CATEGORY_COLORS.food,
            createdAt: now,
        },
        {
            id: "cat_transport",
            name: t("交通"),
            kind: "expense",
            emoji: "🚇",
            color: CATEGORY_COLORS.transport,
            createdAt: now,
        },
        {
            id: "cat_shopping",
            name: t("购物"),
            kind: "expense",
            emoji: "🛍️",
            color: CATEGORY_COLORS.shopping,
            createdAt: now,
        },
        {
            id: "cat_home",
            name: t("居住"),
            kind: "expense",
            emoji: "🏠",
            color: CATEGORY_COLORS.home,
            createdAt: now,
        },
        {
            id: "cat_fun",
            name: t("娱乐"),
            kind: "expense",
            emoji: "🎮",
            color: CATEGORY_COLORS.fun,
            createdAt: now,
        },
        {
            id: "cat_health",
            name: t("医疗"),
            kind: "expense",
            emoji: "💊",
            color: CATEGORY_COLORS.health,
            createdAt: now,
        },
        {
            id: "cat_study",
            name: t("学习"),
            kind: "expense",
            emoji: "📚",
            color: CATEGORY_COLORS.study,
            createdAt: now,
        },
        {
            id: "cat_other",
            name: t("其他"),
            kind: "expense",
            emoji: "📦",
            color: CATEGORY_COLORS.other,
            createdAt: now,
        },
        {
            id: "cat_salary",
            name: t("工资"),
            kind: "income",
            emoji: "💰",
            color: CATEGORY_COLORS.salary,
            createdAt: now,
        },
        {
            id: "cat_bonus",
            name: t("奖金"),
            kind: "income",
            emoji: "🎁",
            color: CATEGORY_COLORS.bonus,
            createdAt: now,
        },
        {
            id: "cat_invest",
            name: t("理财"),
            kind: "income",
            emoji: "📈",
            color: CATEGORY_COLORS.invest,
            createdAt: now,
        },
        {
            id: "cat_other_income",
            name: t("其他收入"),
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
        tagGroups: createDefaultTagGroups(now),
        tags: createDefaultTags(now),
        budgets: [],
        recurringRules: [],
        attachments: [],
        deletedEntries: [],
        deletedBills: [],
        deletedConfig: [],
        bills: [],
        entries: [],
        settings: {
            currency: "CNY",
            theme: "system",
            defaultTagsSeeded: true,
        },
    };
}

export function createSeedBook(name = t("我的账本"), now = Date.now()): Book {
    return {
        id: newId("book"),
        name,
        createdAt: now,
        updatedAt: now,
        ...createSeedData(now),
    };
}
