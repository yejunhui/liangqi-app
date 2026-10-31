/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type AccountKind = "asset" | "liability";

export type EntryKind = "expense" | "income" | "repayment";

export type CategoryKind = "expense" | "income";

export type BillStatus = "open" | "partial" | "paid";

export type ThemeMode = "light" | "dark" | "system";

export interface Account {
    id: string;
    name: string;
    kind: AccountKind;
    emoji: string;
    /** Opening balance in cents. For liabilities this is the amount owed. */
    openingBalance: number;
    note?: string;
    createdAt: number;
}

export interface Category {
    id: string;
    name: string;
    kind: CategoryKind;
    emoji: string;
    color: string;
    createdAt: number;
}

export interface Bill {
    id: string;
    liabilityAccountId: string;
    /** Opening-balance bills do not have a category. */
    categoryId?: string;
    title: string;
    /** Original amount in cents. */
    principal: number;
    purchasedAt: number;
    dueDate?: number;
    note?: string;
    /** Created automatically from an account opening balance. */
    opening?: boolean;
    createdAt: number;
}

export interface Entry {
    id: string;
    kind: EntryKind;
    /** Always a positive amount in cents. */
    amount: number;
    date: number;
    /** Asset account for cash expenses, income and repayment sources. */
    accountId?: string;
    /** Liability account for credit expenses and repayments. */
    liabilityAccountId?: string;
    /** Links a credit expense or a repayment to a bill. */
    billId?: string;
    categoryId?: string;
    note?: string;
    createdAt: number;
}

export interface Settings {
    currency: string;
    theme: ThemeMode;
}

export interface LedgerData {
    accounts: Account[];
    categories: Category[];
    bills: Bill[];
    entries: Entry[];
    settings: Settings;
}

export interface ExportPayload extends LedgerData {
    app: "liangqi";
    version: 1;
    exportedAt: string;
}
