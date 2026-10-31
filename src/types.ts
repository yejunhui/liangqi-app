/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type AccountKind = "asset" | "liability";

export type EntryKind = "expense" | "income" | "repayment";

export type CategoryKind = "expense" | "income";

export type BillStatus = "open" | "partial" | "paid";

export type ThemeMode = "light" | "dark" | "system";

export interface Member {
    id: string;
    name: string;
    color: string;
    createdAt: number;
}

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
    /** Optional family member this bill belongs to. */
    memberId?: string;
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
    /** Optional family member this entry belongs to. */
    memberId?: string;
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
    members: Member[];
    bills: Bill[];
    entries: Entry[];
    settings: Settings;
}

export interface ExportPayload extends LedgerData {
    app: "liangqi";
    version: 1;
    exportedAt: string;
}

export type RemoteProvider = "github" | "gitee" | "webdav";

export type TokenKind = "pat" | "oauth";

export interface Connection {
    id: string;
    provider: RemoteProvider;
    label: string;
    createdAt: number;
    /** GitHub / Gitee */
    owner?: string;
    repo?: string;
    branch?: string;
    token?: string;
    tokenKind?: TokenKind;
    /** WebDAV */
    url?: string;
    username?: string;
    password?: string;
}

export interface RemoteBinding {
    connectionId: string;
    remoteBookId: string;
    revision?: string;
    lastSyncedAt?: number;
    autoSync: boolean;
}

export interface Book extends LedgerData {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    remote?: RemoteBinding;
}

export interface LibraryData {
    version: 2;
    books: Book[];
    activeBookId: string;
    connections: Connection[];
}

export interface RemoteBookSummary {
    id: string;
    name: string;
    updatedAt: number;
    currency: string;
    entryCount: number;
}

export interface RemoteIndex {
    app: "liangqi";
    version: 1;
    books: RemoteBookSummary[];
}

export interface RemoteBookFile {
    app: "liangqi";
    version: 1;
    book: Book;
    updatedAt: number;
}

export interface ConflictBackup {
    id: string;
    bookId: string;
    name: string;
    savedAt: number;
    book: Book;
}

export interface LibraryExportPayload {
    app: "liangqi";
    version: 2;
    exportedAt: string;
    library: LibraryData;
    secretsIncluded: false;
}

