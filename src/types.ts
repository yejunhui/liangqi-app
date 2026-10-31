/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type AccountKind = "asset" | "liability";

export type EntryKind = "expense" | "income" | "repayment" | "transfer";

export type CategoryKind = "expense" | "income";

export type BillStatus = "open" | "partial" | "paid";

export type ThemeMode = "light" | "dark" | "system";

export interface Member {
    id: string;
    name: string;
    color: string;
    createdAt: number;
}

export interface Actor {
    id: string;
    name: string;
    color?: string;
}

export interface RemoteUser extends Actor {
    provider?: RemoteProvider;
}

export interface Tombstone {
    id: string;
    deletedAt: number;
    ownerId?: string;
}

export interface Account {
    id: string;
    name: string;
    kind: AccountKind;
    emoji: string;
    /** Opening balance in cents. For liabilities this is the amount owed. */
    openingBalance: number;
    /** Whether an asset account counts toward disposable assets. Defaults to true. */
    liquid?: boolean;
    note?: string;
    createdAt: number;
}

export interface Category {
    id: string;
    name: string;
    kind: CategoryKind;
    emoji: string;
    color: string;
    /** Optional parent category id, used for two-level categories. */
    parent?: string;
    createdAt: number;
}

export interface TagGroup {
    id: string;
    name: string;
    selection: "single" | "multiple";
    createdAt: number;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    groupId?: string;
    createdAt: number;
}

export type BudgetPeriod = "month" | "year";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurringRule {
    id: string;
    name: string;
    kind: "expense" | "income";
    /** Amount in cents. */
    amount: number;
    frequency: RecurringFrequency;
    /** Every N days / weeks / months / years. */
    interval: number;
    startDate: number;
    nextDueDate: number;
    endDate?: number;
    enabled: boolean;
    lastPostedAt?: number;
    categoryId: string;
    /** Asset account for income and cash expenses. */
    accountId?: string;
    /** Liability account when a recurring expense is credited. */
    liabilityAccountId?: string;
    memberId?: string;
    tagIds?: string[];
    note?: string;
    createdAt: number;
    ownerId?: string;
    ownerName?: string;
    updatedAt?: number;
}

export interface Budget {
    id: string;
    name: string;
    period: BudgetPeriod;
    /** Budget amount in cents. */
    amount: number;
    categoryIds: string[];
    tagIds: string[];
    memberIds: string[];
    createdAt: number;
}

export interface Attachment {
    id: string;
    name: string;
    mimeType: string;
    /** File size in bytes. */
    size: number;
    createdAt: number;
    ownerId?: string;
    ownerName?: string;
}

export interface EntryLocation {
    lat: number;
    lng: number;
    label?: string;
}

/** A foreign-currency amount converted into the book's base currency. */
export interface OriginalAmount {
    currency: string;
    /** Amount in the foreign currency's minor units. */
    amount: number;
    /** Base-currency units per one foreign-currency unit. */
    rate: number;
}

export interface Bill {
    id: string;
    liabilityAccountId: string;
    /** Opening-balance bills do not have a category. */
    categoryId?: string;
    /** Optional family member this bill belongs to. */
    memberId?: string;
    tagIds?: string[];
    attachmentIds?: string[];
    originalAmount?: OriginalAmount;
    ownerId?: string;
    ownerName?: string;
    updatedAt?: number;
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
    /** Destination asset account for transfers. */
    toAccountId?: string;
    /** Links a credit expense or a repayment to a bill. */
    billId?: string;
    categoryId?: string;
    /** Optional family member this entry belongs to. */
    memberId?: string;
    tagIds?: string[];
    attachmentIds?: string[];
    ownerId?: string;
    ownerName?: string;
    updatedAt?: number;
    location?: EntryLocation;
    originalAmount?: OriginalAmount;
    note?: string;
    /** Links an automatically posted entry to its recurring rule. */
    recurringId?: string;
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
    tagGroups: TagGroup[];
    tags: Tag[];
    budgets: Budget[];
    recurringRules: RecurringRule[];
    attachments: Attachment[];
    deletedEntries: Tombstone[];
    deletedBills: Tombstone[];
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
    /** Resolved identity of the user behind this connection. */
    user?: RemoteUser;
}

export interface RemoteBinding {
    connectionId: string;
    remoteBookId: string;
    revision?: string;
    lastSyncedAt?: number;
    autoSync: boolean;
    /** Cache of the remote chunk manifest, used for incremental uploads. */
    manifest?: RemoteBookManifest;
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

export interface RemoteChunkRef {
    path: string;
    start: number;
    count: number;
    hash: string;
}

export interface RemoteBookManifest {
    app: "liangqi";
    version: 2;
    bookId: string;
    name: string;
    updatedAt: number;
    currency: string;
    entryCount: number;
    billCount: number;
    metaHash: string;
    chunks: {
        entries: RemoteChunkRef[];
        bills: RemoteChunkRef[];
    };
}

export interface RemoteBookMetaFile {
    app: "liangqi";
    version: 2;
    book: Omit<Book, "entries" | "bills" | "remote">;
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

