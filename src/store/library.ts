/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import { get, set } from "idb-keyval";
import type {
    Book,
    Connection,
    LibraryData,
    RemoteBinding,
} from "@/types";
import { createSeedBook } from "@/domain/seed";
import { createDefaultMember } from "@/domain/members";
import { seedDefaultTags } from "@/domain/tags";
import { newId } from "@/utils/id";

export const LIBRARY_STORAGE_KEY = "liangqi-library-v2";
const LIBRARY_IDB_KEY = "liangqi-library-v2";
const LEGACY_LEDGER_KEYS = ["liangqi-ledger-v1", "zhaibu-ledger-v1"] as const;

type PersistedLedger = {
    accounts?: unknown;
    categories?: unknown;
    bills?: unknown;
    entries?: unknown;
    settings?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBook(value: unknown): value is Book {
    if (!isObject(value)) {
        return false;
    }
    return (
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.createdAt === "number" &&
        typeof value.updatedAt === "number" &&
        Array.isArray(value.accounts) &&
        Array.isArray(value.categories) &&
        Array.isArray(value.bills) &&
        Array.isArray(value.entries) &&
        isObject(value.settings)
    );
}

function normalizeLibrary(raw: unknown): LibraryData | null {
    if (!isObject(raw) || !Array.isArray(raw.books)) {
        return null;
    }
    const books = raw.books
        .filter(isBook)
        .map((book) =>
            seedDefaultTags({
                ...book,
                members:
                    Array.isArray(book.members) && book.members.length > 0
                        ? book.members
                        : [createDefaultMember()],
                tagGroups: Array.isArray(book.tagGroups) ? book.tagGroups : [],
                tags: Array.isArray(book.tags) ? book.tags : [],
                budgets: Array.isArray(book.budgets) ? book.budgets : [],
                recurringRules: Array.isArray(book.recurringRules) ? book.recurringRules : [],
                attachments: Array.isArray(book.attachments) ? book.attachments : [],
                deletedEntries: Array.isArray(book.deletedEntries) ? book.deletedEntries : [],
                deletedBills: Array.isArray(book.deletedBills) ? book.deletedBills : [],
                deletedConfig: Array.isArray(book.deletedConfig) ? book.deletedConfig : [],
            }),
        );
    if (books.length === 0) {
        return null;
    }
    const activeBookId =
        typeof raw.activeBookId === "string" &&
        books.some((book) => book.id === raw.activeBookId)
            ? raw.activeBookId
            : books[0].id;
    const connections = Array.isArray(raw.connections)
        ? (raw.connections.filter(
              (item): item is Connection =>
                  isObject(item) &&
                  typeof item.id === "string" &&
                  typeof item.provider === "string" &&
                  typeof item.label === "string" &&
                  typeof item.createdAt === "number",
          ) as Connection[])
        : [];
    return {
        version: 2,
        books,
        activeBookId,
        connections,
    };
}

function ledgerFromPersisted(raw: unknown): PersistedLedger | null {
    if (!isObject(raw)) {
        return null;
    }
    const state = isObject(raw.state) ? raw.state : raw;
    if (
        !Array.isArray(state.accounts) ||
        !Array.isArray(state.categories) ||
        !Array.isArray(state.bills) ||
        !Array.isArray(state.entries) ||
        !isObject(state.settings)
    ) {
        return null;
    }
    return state;
}

function migrateLegacyLedger(): LibraryData | null {
    if (typeof window === "undefined") {
        return null;
    }
    for (const key of LEGACY_LEDGER_KEYS) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                continue;
            }
            const ledger = ledgerFromPersisted(JSON.parse(raw));
            if (!ledger) {
                continue;
            }
            const now = Date.now();
            const book: Book = {
                id: newId("book"),
                name: "我的账本",
                createdAt: now,
                updatedAt: now,
                accounts: ledger.accounts as Book["accounts"],
                categories: ledger.categories as Book["categories"],
                members: [createDefaultMember(now)],
                tagGroups: [],
                tags: [],
                budgets: [],
                recurringRules: [],
                attachments: [],
                deletedEntries: [],
                deletedBills: [],
                deletedConfig: [],
                bills: ledger.bills as Book["bills"],
                entries: ledger.entries as Book["entries"],
                settings: ledger.settings as Book["settings"],
            };
            return {
                version: 2,
                books: [book],
                activeBookId: book.id,
                connections: [],
            };
        } catch {
            // Try the next legacy key.
        }
    }
    return null;
}

function createInitialLibrary(): LibraryData {
    if (typeof window !== "undefined") {
        try {
            const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
            if (raw) {
                const library = normalizeLibrary(JSON.parse(raw));
                if (library) {
                    return library;
                }
            }
        } catch {
            // Fall through to legacy migration / seed data.
        }
    }

    const migrated = migrateLegacyLedger();
    if (migrated) {
        return migrated;
    }

    const book = createSeedBook();
    return {
        version: 2,
        books: [book],
        activeBookId: book.id,
        connections: [],
    };
}

async function loadLibraryFromIdb(): Promise<LibraryData | null> {
    try {
        const raw = await get(LIBRARY_IDB_KEY);
        return normalizeLibrary(raw);
    } catch {
        return null;
    }
}

let idbWriteQueue: Promise<void> = Promise.resolve();

async function saveLibraryToIdb(library: LibraryData): Promise<void> {
    idbWriteQueue = idbWriteQueue
        .catch(() => undefined)
        .then(async () => {
            try {
                await set(LIBRARY_IDB_KEY, library);
            } catch {
                // Fallback to localStorage.
            }
        });
    return idbWriteQueue;
}

/**
 * IndexedDB is the primary local store. localStorage is kept as a synchronous
 * fallback for older browsers and for the initial module state.
 */
export async function bootstrapLibrary(): Promise<LibraryData> {
    const fromIdb = await loadLibraryFromIdb();
    if (fromIdb) {
        saveLibrary(fromIdb);
        return fromIdb;
    }
    const initial = createInitialLibrary();
    saveLibrary(initial);
    await saveLibraryToIdb(initial);
    return initial;
}

export function saveLibrary(library: LibraryData): boolean {
    void saveLibraryToIdb(library);
    if (typeof window === "undefined") {
        return false;
    }
    try {
        window.localStorage.setItem(
            LIBRARY_STORAGE_KEY,
            JSON.stringify({
                version: 2,
                books: library.books,
                activeBookId: library.activeBookId,
                connections: library.connections,
            }),
        );
        return true;
    } catch {
        return false;
    }
}

export function extractLibrary(state: LibraryState): LibraryData {
    return {
        version: 2,
        books: state.books,
        activeBookId: state.activeBookId,
        connections: state.connections,
    };
}

export interface LibraryActions {
    createBook: (name: string) => Book;
    renameBook: (bookId: string, name: string) => boolean;
    deleteBook: (bookId: string) => string | false;
    setActiveBookId: (bookId: string) => boolean;
    upsertBook: (book: Book) => void;
    setBookRemote: (bookId: string, remote: RemoteBinding | undefined) => void;
    addConnection: (connection: Connection) => void;
    updateConnection: (connectionId: string, patch: Partial<Connection>) => void;
    removeConnection: (connectionId: string) => void;
    importLibrary: (library: LibraryData) => void;
    resetLibrary: () => void;
}

export type LibraryState = LibraryData & LibraryActions;

const initial = createInitialLibrary();

function persist(get: () => LibraryState): void {
    saveLibrary(extractLibrary(get()));
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
    ...initial,

    createBook(name) {
        const trimmed = name.trim() || "未命名账本";
        const book = createSeedBook(trimmed);
        set((state) => ({
            books: [...state.books, book],
            activeBookId: book.id,
        }));
        persist(get);
        return book;
    },

    renameBook(bookId, name) {
        const trimmed = name.trim();
        if (!trimmed) {
            return false;
        }
        const exists = get().books.some((book) => book.id === bookId);
        if (!exists) {
            return false;
        }
        set((state) => ({
            books: state.books.map((book) =>
                book.id === bookId
                    ? { ...book, name: trimmed, updatedAt: Date.now() }
                    : book,
            ),
        }));
        persist(get);
        return true;
    },

    deleteBook(bookId) {
        const state = get();
        if (state.books.length <= 1) {
            return false;
        }
        const remaining = state.books.filter((book) => book.id !== bookId);
        if (remaining.length === state.books.length) {
            return false;
        }
        const nextActive =
            state.activeBookId === bookId ? remaining[0].id : state.activeBookId;
        set({ books: remaining, activeBookId: nextActive });
        persist(get);
        return nextActive;
    },

    setActiveBookId(bookId) {
        if (!get().books.some((book) => book.id === bookId)) {
            return false;
        }
        set({ activeBookId: bookId });
        persist(get);
        return true;
    },

    upsertBook(book) {
        set((state) => {
            const exists = state.books.some((item) => item.id === book.id);
            return {
                books: exists
                    ? state.books.map((item) => (item.id === book.id ? book : item))
                    : [...state.books, book],
            };
        });
        persist(get);
    },

    setBookRemote(bookId, remote) {
        set((state) => ({
            books: state.books.map((book) =>
                book.id === bookId ? { ...book, remote } : book,
            ),
        }));
        persist(get);
    },

    addConnection(connection) {
        set((state) => ({ connections: [...state.connections, connection] }));
        persist(get);
    },

    updateConnection(connectionId, patch) {
        set((state) => ({
            connections: state.connections.map((connection) =>
                connection.id === connectionId ? { ...connection, ...patch } : connection,
            ),
        }));
        persist(get);
    },

    removeConnection(connectionId) {
        set((state) => ({
            connections: state.connections.filter(
                (connection) => connection.id !== connectionId,
            ),
            books: state.books.map((book) =>
                book.remote?.connectionId === connectionId
                    ? { ...book, remote: undefined }
                    : book,
            ),
        }));
        persist(get);
    },

    importLibrary(library) {
        const next = normalizeLibrary(library) ?? createInitialLibrary();
        set(next);
        persist(get);
    },

    resetLibrary() {
        const book = createSeedBook();
        set({
            version: 2,
            books: [book],
            activeBookId: book.id,
            connections: [],
        });
        persist(get);
    },
}));

export function getActiveBook(state: LibraryState): Book {
    return (
        state.books.find((book) => book.id === state.activeBookId) ?? state.books[0]
    );
}

export function getBookById(state: LibraryState, bookId: string): Book | undefined {
    return state.books.find((book) => book.id === bookId);
}

export function getConnectionById(
    state: LibraryState,
    connectionId: string,
): Connection | undefined {
    return state.connections.find((connection) => connection.id === connectionId);
}
