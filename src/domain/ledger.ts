/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Pure accounting helpers. All amounts are integer cents.
 *
 * Core model:
 * - Cash expense: asset ↓, expense ↑
 * - Credit expense: liability ↑, expense ↑ (asset unchanged)
 * - Repayment: asset ↓, liability ↓ (expense unchanged)
 * - Income: asset ↑, income ↑
 */

import type { Account, Bill, BillStatus, Category, Entry, LedgerData } from "@/types";
import { formatDate, isInMonth, startOfDay } from "@/utils/date";
import { formatCents } from "@/domain/money";

export function getAccountBalance(account: Account, entries: Entry[]): number {
    let balance = account.openingBalance;

    for (const entry of entries) {
        if (account.kind === "asset") {
            if (entry.accountId !== account.id) {
                continue;
            }
            if (entry.kind === "expense" || entry.kind === "repayment") {
                balance -= entry.amount;
            } else if (entry.kind === "income") {
                balance += entry.amount;
            }
            continue;
        }

        if (entry.liabilityAccountId !== account.id) {
            continue;
        }
        if (entry.kind === "expense") {
            balance += entry.amount;
        } else if (entry.kind === "repayment") {
            balance -= entry.amount;
        }
    }

    return balance;
}

export function getAssetAccounts(accounts: Account[]): Account[] {
    return accounts.filter((account) => account.kind === "asset");
}

export function getLiabilityAccounts(accounts: Account[]): Account[] {
    return accounts.filter((account) => account.kind === "liability");
}

export interface Totals {
    assets: number;
    liabilities: number;
    netWorth: number;
    /** Liquid assets minus all liabilities. */
    disposable: number;
}

export function getTotals(data: Pick<LedgerData, "accounts" | "entries">): Totals {
    let assets = 0;
    let liabilities = 0;
    let liquidAssets = 0;

    for (const account of data.accounts) {
        const balance = getAccountBalance(account, data.entries);
        if (account.kind === "asset") {
            assets += balance;
            if (account.liquid !== false) {
                liquidAssets += balance;
            }
        } else {
            liabilities += balance;
        }
    }

    return {
        assets,
        liabilities,
        netWorth: assets - liabilities,
        disposable: liquidAssets - liabilities,
    };
}

export function getBillRepaid(billId: string, entries: Entry[]): number {
    return entries
        .filter((entry) => entry.kind === "repayment" && entry.billId === billId)
        .reduce((total, entry) => total + entry.amount, 0);
}

export function getBillRemaining(bill: Bill, entries: Entry[]): number {
    return Math.max(0, bill.principal - getBillRepaid(bill.id, entries));
}

export function getBillStatus(bill: Bill, entries: Entry[]): BillStatus {
    const repaid = getBillRepaid(bill.id, entries);
    if (repaid >= bill.principal) {
        return "paid";
    }
    if (repaid > 0) {
        return "partial";
    }
    return "open";
}

export function getBillProgress(bill: Bill, entries: Entry[]): number {
    if (bill.principal <= 0) {
        return 1;
    }
    return Math.min(1, getBillRepaid(bill.id, entries) / bill.principal);
}

export function getBillRepayments(billId: string, entries: Entry[]): Entry[] {
    return entries
        .filter((entry) => entry.kind === "repayment" && entry.billId === billId)
        .sort((a, b) => b.date - a.date);
}

export function getLinkedExpense(billId: string, entries: Entry[]): Entry | undefined {
    return entries.find((entry) => entry.kind === "expense" && entry.billId === billId);
}

export function getOpenBills(bills: Bill[], entries: Entry[]): Bill[] {
    return bills
        .filter((bill) => getBillRemaining(bill, entries) > 0)
        .sort((a, b) => {
            if (a.dueDate && b.dueDate) {
                return a.dueDate - b.dueDate;
            }
            if (a.dueDate) {
                return -1;
            }
            if (b.dueDate) {
                return 1;
            }
            return b.purchasedAt - a.purchasedAt;
        });
}

export function getOutstandingTotal(bills: Bill[], entries: Entry[]): number {
    return bills.reduce((total, bill) => total + getBillRemaining(bill, entries), 0);
}

export function getOverdueBills(bills: Bill[], entries: Entry[], now = Date.now()): Bill[] {
    const today = startOfDay(now);
    return getOpenBills(bills, entries).filter(
        (bill) => bill.dueDate !== undefined && startOfDay(bill.dueDate) < today,
    );
}

export interface MonthTotals {
    expense: number;
    income: number;
    repayment: number;
    net: number;
}

export function getMonthTotals(entries: Entry[], monthTimestamp: number): MonthTotals {
    const totals: MonthTotals = { expense: 0, income: 0, repayment: 0, net: 0 };

    for (const entry of entries) {
        if (!isInMonth(entry.date, monthTimestamp)) {
            continue;
        }
        if (entry.kind === "expense") {
            totals.expense += entry.amount;
        } else if (entry.kind === "income") {
            totals.income += entry.amount;
        } else {
            totals.repayment += entry.amount;
        }
    }

    totals.net = totals.income - totals.expense;
    return totals;
}

export interface CategoryBreakdownItem {
    categoryId: string | null;
    name: string;
    emoji: string;
    color: string;
    amount: number;
    share: number;
}

export function getCategoryBreakdown(
    entries: Entry[],
    categories: Category[],
    monthTimestamp: number,
): CategoryBreakdownItem[] {
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const totals = new Map<string, number>();
    let total = 0;

    for (const entry of entries) {
        if (entry.kind !== "expense" || !isInMonth(entry.date, monthTimestamp)) {
            continue;
        }
        const key = entry.categoryId ?? "uncategorized";
        totals.set(key, (totals.get(key) ?? 0) + entry.amount);
        total += entry.amount;
    }

    return [...totals.entries()]
        .map(([categoryId, amount]) => {
            const category = categoryMap.get(categoryId);
            return {
                categoryId: category ? category.id : null,
                name: category?.name ?? "未分类",
                emoji: category?.emoji ?? "📦",
                color: category?.color ?? "#a8a29e",
                amount,
                share: total > 0 ? amount / total : 0,
            };
        })
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount);
}

export interface DailyExpense {
    timestamp: number;
    amount: number;
}

export function getRecentDailyExpenses(entries: Entry[], days = 7, now = Date.now()): DailyExpense[] {
    const today = startOfDay(now);
    const result: DailyExpense[] = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const dayStart = today - offset * 24 * 60 * 60 * 1000;
        const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
        const amount = entries
            .filter(
                (entry) =>
                    entry.kind === "expense" && entry.date >= dayStart && entry.date <= dayEnd,
            )
            .reduce((total, entry) => total + entry.amount, 0);
        result.push({ timestamp: dayStart, amount });
    }

    return result;
}

export type DueTone = "neutral" | "warning" | "danger" | "success";

export interface DueInfo {
    label: string;
    tone: DueTone;
}

export function getBillDueInfo(
    bill: Bill,
    status: BillStatus,
    now = Date.now(),
): DueInfo {
    if (status === "paid") {
        return { label: "已还清", tone: "success" };
    }
    if (bill.dueDate === undefined) {
        return { label: "未设到期日", tone: "neutral" };
    }

    const days = Math.round(
        (startOfDay(bill.dueDate) - startOfDay(now)) / (24 * 60 * 60 * 1000),
    );

    if (days < 0) {
        return { label: `逾期 ${Math.abs(days)} 天`, tone: "danger" };
    }
    if (days === 0) {
        return { label: "今天到期", tone: "warning" };
    }
    if (days <= 7) {
        return { label: `${days} 天后到期`, tone: "warning" };
    }
    return { label: `${formatDate(bill.dueDate)}到期`, tone: "neutral" };
}

export function getAccountUsage(accountId: string, data: Pick<LedgerData, "bills" | "entries">) {
    const entryCount = data.entries.filter(
        (entry) => entry.accountId === accountId || entry.liabilityAccountId === accountId,
    ).length;
    const billCount = data.bills.filter((bill) => bill.liabilityAccountId === accountId).length;
    return { entryCount, billCount };
}

export function getCategoryUsage(
    categoryId: string,
    data: Pick<LedgerData, "bills" | "entries">,
): number {
    const entryCount = data.entries.filter((entry) => entry.categoryId === categoryId).length;
    const billCount = data.bills.filter((bill) => bill.categoryId === categoryId).length;
    return entryCount + billCount;
}

export function validateRepayment(
    bill: Bill,
    entries: Entry[],
    amount: number,
    assetAccount: Account | undefined,
): string | null {
    if (!assetAccount || assetAccount.kind !== "asset") {
        return "请选择一个储蓄账户";
    }
    if (!Number.isInteger(amount) || amount <= 0) {
        return "还款金额必须大于 0";
    }
    const remaining = getBillRemaining(bill, entries);
    if (remaining <= 0) {
        return "这笔账单已经还清";
    }
    if (amount > remaining) {
        return `还款金额不能超过待还金额 ${formatCents(remaining)}`;
    }
    return null;
}
