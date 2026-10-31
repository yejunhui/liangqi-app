/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Account, Category, EntryKind } from "@/types";
import { toDateInputValue } from "@/utils/date";

export interface QuickEntrySuggestion {
    kind: EntryKind;
    paymentMode: "asset" | "liability";
    /** Amount in cents. */
    amount: number;
    date: number;
    note: string;
    categoryId?: string;
    accountId?: string;
    liabilityAccountId?: string;
}

export interface QuickEntryParseResult {
    ok: boolean;
    suggestion?: QuickEntrySuggestion;
    error?: string;
}

const NUMBER_PATTERN = String.raw`\d+(?:,\d{3})*(?:\.\d{1,2})?`;

function extractAmount(text: string): number | null {
    const currency = text.match(new RegExp(`(?:¥|￥)\\s*(${NUMBER_PATTERN})`));
    if (currency) {
        return Math.round(Number.parseFloat(currency[1].replace(/,/g, "")) * 100);
    }
    const yuan = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*(?:元|块|块钱)`));
    if (yuan) {
        return Math.round(Number.parseFloat(yuan[1].replace(/,/g, "")) * 100);
    }
    const numbers = [...text.matchAll(new RegExp(`(${NUMBER_PATTERN})`, "g"))];
    for (let index = numbers.length - 1; index >= 0; index -= 1) {
        const match = numbers[index];
        const after = text.slice((match.index ?? 0) + match[0].length).trimStart();
        if (/^(?:月|日|号|年)/.test(after)) {
            continue;
        }
        const value = Math.round(
            Number.parseFloat(match[1].replace(/,/g, "")) * 100,
        );
        if (value > 0) {
            return value;
        }
    }
    return null;
}

function extractDate(text: string, now: number): number {
    const day = new Date(now);
    if (text.includes("前天")) {
        day.setDate(day.getDate() - 2);
        return day.getTime();
    }
    if (text.includes("昨天")) {
        day.setDate(day.getDate() - 1);
        return day.getTime();
    }
    if (text.includes("明天")) {
        day.setDate(day.getDate() + 1);
        return day.getTime();
    }
    const monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
    if (monthDay) {
        const candidate = new Date(
            day.getFullYear(),
            Number(monthDay[1]) - 1,
            Number(monthDay[2]),
            12,
        );
        if (candidate.getTime() > now + 86_400_000) {
            candidate.setFullYear(candidate.getFullYear() - 1);
        }
        return candidate.getTime();
    }
    return now;
}

function findName<T extends { id: string; name: string }>(
    names: T[],
    text: string,
): T | undefined {
    const candidates = names
        .filter((item) => item.name.trim() !== "")
        .sort((a, b) => b.name.length - a.name.length);
    return candidates.find((item) => text.includes(item.name));
}

const CATEGORY_HINTS: Array<{ pattern: RegExp; names: string[] }> = [
    {
        pattern: /早餐|早饭|午餐|午饭|晚餐|晚饭|吃饭|外卖|咖啡|奶茶|餐厅|食堂|零食|水果/,
        names: ["餐饮", "吃饭", "食品", "零食"],
    },
    {
        pattern: /打车|滴滴|出租车|地铁|公交|加油|停车|高铁|机票/,
        names: ["交通", "打车", "出行"],
    },
    {
        pattern: /房租|水费|电费|燃气|物业/,
        names: ["住房", "房租", "生活缴费", "居家"],
    },
    {
        pattern: /工资|薪水|奖金|报销|利息|分红/,
        names: ["工资", "收入", "奖金"],
    },
    {
        pattern: /淘宝|京东|超市|购物|日用品/,
        names: ["购物", "日用", "超市"],
    },
    {
        pattern: /电影|游戏|娱乐|旅游|旅行/,
        names: ["娱乐", "旅行", "旅游"],
    },
    {
        pattern: /医院|医药|看病|买药/,
        names: ["医疗", "健康", "医药"],
    },
];

function findCategory(categories: Category[], text: string): Category | undefined {
    const direct = findName(categories, text);
    if (direct) {
        return direct;
    }
    for (const hint of CATEGORY_HINTS) {
        if (!hint.pattern.test(text)) {
            continue;
        }
        const match = categories.find((category) =>
            hint.names.some(
                (name) =>
                    category.name.includes(name) || name.includes(category.name),
            ),
        );
        if (match) {
            return match;
        }
    }
    return undefined;
}

export function parseQuickEntry(input: {
    text: string;
    categories: Category[];
    accounts: Account[];
    now?: number;
}): QuickEntryParseResult {
    const text = input.text.trim();
    if (!text) {
        return { ok: false, error: "说点什么，或者输入一句话" };
    }
    const now = input.now ?? Date.now();
    const amount = extractAmount(text);
    if (amount === null || amount <= 0) {
        return { ok: false, error: "没有识别到金额，例如「午饭 35」" };
    }
    const income = /收入|工资|奖金|报销|退款|收到|进账|利息|分红|卖了/.test(text);
    const liability = /信用卡|花呗|白条|赊账|赊|负债|分期/.test(text);
    const kind: EntryKind = income ? "income" : "expense";
    const paymentMode = !income && liability ? "liability" : "asset";
    const categoryPool = input.categories.filter((category) => category.kind === kind);
    const accountPool = input.accounts.filter((account) =>
        paymentMode === "liability"
            ? account.kind === "liability"
            : account.kind === "asset",
    );
    const category = findCategory(categoryPool, text);
    const account = findName(accountPool, text);

    return {
        ok: true,
        suggestion: {
            kind,
            paymentMode,
            amount,
            date: extractDate(text, now),
            note: text,
            categoryId: category?.id,
            accountId: paymentMode === "asset" ? account?.id : undefined,
            liabilityAccountId: paymentMode === "liability" ? account?.id : undefined,
        },
    };
}

export function describeQuickEntry(
    suggestion: QuickEntrySuggestion,
    categories: Category[],
    accounts: Account[],
): string {
    const category = categories.find((item) => item.id === suggestion.categoryId);
    const account = accounts.find(
        (item) =>
            item.id ===
            (suggestion.liabilityAccountId ?? suggestion.accountId),
    );
    return [
        suggestion.kind === "income" ? "收入" : "支出",
        suggestion.paymentMode === "liability" ? "赊账" : "存款",
        category?.name ?? "默认分类",
        account?.name ?? "默认账户",
        toDateInputValue(suggestion.date),
    ].join(" · ");
}
