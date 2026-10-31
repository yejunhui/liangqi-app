/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    Account,
    Bill,
    Category,
    Entry,
    ExportPayload,
    LedgerData,
    Settings,
} from "@/types";

type Rec = Record<string, unknown>;

function isObject(value: unknown): value is Rec {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

function optionalString(value: unknown): boolean {
    return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
    return value === undefined || isFiniteNumber(value);
}

function requiredString(value: unknown, label: string): string {
    if (!isString(value) || value.trim() === "") {
        throw new Error(`${label}格式不正确`);
    }
    return value;
}

function requiredInteger(value: unknown, label: string, min = 0): number {
    if (!isInteger(value) || value < min) {
        throw new Error(`${label}格式不正确`);
    }
    return value;
}

function requiredTimestamp(value: unknown, label: string): number {
    if (!isFiniteNumber(value) || value <= 0) {
        throw new Error(`${label}格式不正确`);
    }
    return value;
}

function parseAccount(raw: unknown, index: number): Account {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个账户格式不正确`);
    }
    const kind = raw.kind;
    if (kind !== "asset" && kind !== "liability") {
        throw new Error(`第 ${index + 1} 个账户类型不正确`);
    }
    if (!optionalString(raw.note)) {
        throw new Error(`第 ${index + 1} 个账户备注格式不正确`);
    }
    return {
        id: requiredString(raw.id, "账户 id"),
        name: requiredString(raw.name, "账户名称"),
        kind,
        emoji: requiredString(raw.emoji, "账户图标"),
        openingBalance: requiredInteger(raw.openingBalance, "账户期初余额"),
        note: raw.note as string | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "账户创建时间"),
    };
}

function parseCategory(raw: unknown, index: number): Category {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个分类格式不正确`);
    }
    const kind = raw.kind;
    if (kind !== "expense" && kind !== "income") {
        throw new Error(`第 ${index + 1} 个分类类型不正确`);
    }
    return {
        id: requiredString(raw.id, "分类 id"),
        name: requiredString(raw.name, "分类名称"),
        kind,
        emoji: requiredString(raw.emoji, "分类图标"),
        color: requiredString(raw.color, "分类颜色"),
        createdAt: requiredTimestamp(raw.createdAt, "分类创建时间"),
    };
}

function parseBill(raw: unknown, index: number): Bill {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 张账单格式不正确`);
    }
    if (!optionalString(raw.categoryId) || !optionalString(raw.note)) {
        throw new Error(`第 ${index + 1} 张账单字段格式不正确`);
    }
    if (!optionalNumber(raw.dueDate)) {
        throw new Error(`第 ${index + 1} 张账单到期日格式不正确`);
    }
    if (raw.dueDate !== undefined && (!isFiniteNumber(raw.dueDate) || raw.dueDate <= 0)) {
        throw new Error(`第 ${index + 1} 张账单到期日格式不正确`);
    }
    if (raw.opening !== undefined && typeof raw.opening !== "boolean") {
        throw new Error(`第 ${index + 1} 张账单期初标记格式不正确`);
    }
    return {
        id: requiredString(raw.id, "账单 id"),
        liabilityAccountId: requiredString(raw.liabilityAccountId, "账单负债账户"),
        categoryId: raw.categoryId as string | undefined,
        title: requiredString(raw.title, "账单名称"),
        principal: requiredInteger(raw.principal, "账单金额", 1),
        purchasedAt: requiredTimestamp(raw.purchasedAt, "账单消费时间"),
        dueDate: raw.dueDate as number | undefined,
        note: raw.note as string | undefined,
        opening: raw.opening as boolean | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "账单创建时间"),
    };
}

function parseEntry(raw: unknown, index: number): Entry {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 条流水格式不正确`);
    }
    const kind = raw.kind;
    if (kind !== "expense" && kind !== "income" && kind !== "repayment") {
        throw new Error(`第 ${index + 1} 条流水类型不正确`);
    }
    for (const key of ["accountId", "liabilityAccountId", "billId", "categoryId", "note"] as const) {
        if (!optionalString(raw[key])) {
            throw new Error(`第 ${index + 1} 条流水 ${key} 格式不正确`);
        }
    }
    return {
        id: requiredString(raw.id, "流水 id"),
        kind,
        amount: requiredInteger(raw.amount, "流水金额", 1),
        date: requiredTimestamp(raw.date, "流水日期"),
        accountId: raw.accountId as string | undefined,
        liabilityAccountId: raw.liabilityAccountId as string | undefined,
        billId: raw.billId as string | undefined,
        categoryId: raw.categoryId as string | undefined,
        note: raw.note as string | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "流水创建时间"),
    };
}

function parseSettings(raw: unknown): Settings {
    if (!isObject(raw)) {
        throw new Error("设置格式不正确");
    }
    if (!isString(raw.currency) || !/^[A-Z]{3}$/.test(raw.currency)) {
        throw new Error("货币代码格式不正确");
    }
    const theme = raw.theme;
    if (theme !== "light" && theme !== "dark" && theme !== "system") {
        throw new Error("主题设置格式不正确");
    }
    return { currency: raw.currency, theme };
}

function validateReferences(data: LedgerData): void {
    const accounts = new Map(data.accounts.map((account) => [account.id, account]));
    const categories = new Map(data.categories.map((category) => [category.id, category]));
    const bills = new Map(data.bills.map((bill) => [bill.id, bill]));
    const entriesByBill = new Map<string, Entry[]>();
    for (const entry of data.entries) {
        if (entry.billId) {
            const list = entriesByBill.get(entry.billId) ?? [];
            list.push(entry);
            entriesByBill.set(entry.billId, list);
        }
    }

    for (const account of data.accounts) {
        if (account.kind !== "liability") {
            continue;
        }
        const openingBills = data.bills.filter(
            (bill) => bill.liabilityAccountId === account.id && bill.opening,
        );
        if (account.openingBalance > 0) {
            if (
                openingBills.length !== 1 ||
                openingBills[0].principal !== account.openingBalance
            ) {
                throw new Error(`负债账户“${account.name}”缺少匹配的期初账单`);
            }
        } else if (openingBills.length > 0) {
            throw new Error(`负债账户“${account.name}”的期初账单金额不正确`);
        }
    }

    for (const bill of data.bills) {
        const liability = accounts.get(bill.liabilityAccountId);
        if (!liability || liability.kind !== "liability") {
            throw new Error(`账单“${bill.title}”关联的负债账户不存在`);
        }
        if (bill.categoryId) {
            const category = categories.get(bill.categoryId);
            if (!category || category.kind !== "expense") {
                throw new Error(`账单“${bill.title}”关联的支出分类不存在`);
            }
        }
        const linked = entriesByBill.get(bill.id) ?? [];
        const linkedExpense = linked.find((entry) => entry.kind === "expense");
        const repayments = linked.filter((entry) => entry.kind === "repayment");
        if (bill.opening) {
            if (linkedExpense) {
                throw new Error(`期初账单“${bill.title}”不应关联新的支出流水`);
            }
        } else if (!linkedExpense || linkedExpense.amount !== bill.principal) {
            throw new Error(`账单“${bill.title}”缺少对应的赊账流水`);
        }
        if (linkedExpense && linkedExpense.categoryId !== bill.categoryId) {
            throw new Error(`账单“${bill.title}”与赊账流水的分类不一致`);
        }
        const repaid = repayments.reduce((sum, entry) => sum + entry.amount, 0);
        if (repaid > bill.principal) {
            throw new Error(`账单“${bill.title}”的还款金额超过本金`);
        }
    }

    for (const entry of data.entries) {
        if (entry.kind === "expense") {
            if (entry.billId) {
                const bill = bills.get(entry.billId);
                if (!bill) {
                    throw new Error("赊账流水关联的账单不存在");
                }
                if (entry.liabilityAccountId !== bill.liabilityAccountId) {
                    throw new Error("赊账流水的负债账户与账单不一致");
                }
                if (entry.accountId) {
                    throw new Error("赊账流水不应同时指定储蓄账户");
                }
                if (entry.categoryId && bill.categoryId && entry.categoryId !== bill.categoryId) {
                    throw new Error("赊账流水的分类与账单不一致");
                }
            } else {
                if (entry.liabilityAccountId) {
                    throw new Error("现金支出不应关联负债账户");
                }
                const account = entry.accountId ? accounts.get(entry.accountId) : undefined;
                if (!account || account.kind !== "asset") {
                    throw new Error("现金支出关联的储蓄账户不存在");
                }
            }
            if (entry.categoryId) {
                const category = categories.get(entry.categoryId);
                if (!category || category.kind !== "expense") {
                    throw new Error("支出流水关联的分类不存在");
                }
            }
        } else if (entry.kind === "income") {
            const account = entry.accountId ? accounts.get(entry.accountId) : undefined;
            if (!account || account.kind !== "asset") {
                throw new Error("收入流水关联的储蓄账户不存在");
            }
            if (entry.billId || entry.liabilityAccountId) {
                throw new Error("收入流水不应关联账单或负债");
            }
            if (entry.categoryId) {
                const category = categories.get(entry.categoryId);
                if (!category || category.kind !== "income") {
                    throw new Error("收入流水关联的分类不存在");
                }
            }
        } else {
            const bill = entry.billId ? bills.get(entry.billId) : undefined;
            if (!bill) {
                throw new Error("还款流水关联的账单不存在");
            }
            const account = entry.accountId ? accounts.get(entry.accountId) : undefined;
            if (!account || account.kind !== "asset") {
                throw new Error("还款流水关联的储蓄账户不存在");
            }
            if (entry.liabilityAccountId !== bill.liabilityAccountId) {
                throw new Error("还款流水的负债账户与账单不一致");
            }
            if (entry.categoryId) {
                throw new Error("还款流水不应设置支出分类");
            }
        }
    }
}

export function createExportPayload(data: LedgerData): ExportPayload {
    return {
        ...data,
        app: "liangqi",
        version: 1,
        exportedAt: new Date().toISOString(),
    };
}

export function parseBackup(raw: unknown): { ok: true; data: LedgerData } | { ok: false; error: string } {
    try {
        if (!isObject(raw)) {
            throw new Error("备份文件格式不正确");
        }
        if (raw.app !== "liangqi" && raw.app !== "zhaibu") {
            throw new Error("不是两讫 v1 的备份文件");
        }
        if (raw.version !== 1) {
            throw new Error("不是两讫 v1 的备份文件");
        }
        if (
            !Array.isArray(raw.accounts) ||
            !Array.isArray(raw.categories) ||
            !Array.isArray(raw.bills) ||
            !Array.isArray(raw.entries)
        ) {
            throw new Error("备份文件缺少账本数据");
        }

        const accounts = raw.accounts.map(parseAccount);
        const categories = raw.categories.map(parseCategory);
        const bills = raw.bills.map(parseBill);
        const entries = raw.entries.map(parseEntry);
        const settings = parseSettings(raw.settings);

        const ids = new Set<string>();
        for (const item of [...accounts, ...categories, ...bills, ...entries]) {
            if (ids.has(item.id)) {
                throw new Error(`存在重复 id：${item.id}`);
            }
            ids.add(item.id);
        }

        const data: LedgerData = { accounts, categories, bills, entries, settings };
        validateReferences(data);
        return { ok: true, data };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "备份文件解析失败",
        };
    }
}
