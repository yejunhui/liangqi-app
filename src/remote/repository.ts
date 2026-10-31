/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    Book,
    Connection,
    RemoteBookFile,
    RemoteBookSummary,
    RemoteIndex,
} from "@/types";
import { createRemoteAdapter } from "@/remote/index";
import { ensureMembers } from "@/domain/members";
import {
    REMOTE_INDEX_PATH,
    remoteBookPath,
} from "@/remote/paths";
import { RemoteConflictError, RemoteError } from "@/remote/errors";
import type { RemoteAdapter, RemoteFile } from "@/remote/adapter";

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

function emptyIndex(): RemoteIndex {
    return { app: "liangqi", version: 1, books: [] };
}

export function parseRemoteIndex(text: string): RemoteIndex {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new RemoteError("远程 index.json 不是合法 JSON");
    }
    if (!isObject(raw) || raw.app !== "liangqi" || raw.version !== 1) {
        throw new RemoteError("远程 index.json 格式不正确");
    }
    if (!Array.isArray(raw.books)) {
        throw new RemoteError("远程 index.json 缺少账本列表");
    }
    const books: RemoteBookSummary[] = raw.books
        .filter(
            (item): item is RemoteBookSummary =>
                isObject(item) &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                typeof item.updatedAt === "number" &&
                typeof item.currency === "string" &&
                typeof item.entryCount === "number",
        )
        .map((item) => ({ ...item }));
    return { app: "liangqi", version: 1, books };
}

export function parseRemoteBookFile(text: string): RemoteBookFile {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new RemoteError("远程账本文件不是合法 JSON");
    }
    if (!isObject(raw) || raw.app !== "liangqi" || raw.version !== 1) {
        throw new RemoteError("远程账本文件格式不正确");
    }
    if (!isBook(raw.book)) {
        throw new RemoteError("远程账本缺少有效数据");
    }
    return {
        app: "liangqi",
        version: 1,
        book: {
            ...raw.book,
            members: ensureMembers(raw.book).members,
        },
        updatedAt:
            typeof raw.updatedAt === "number" ? raw.updatedAt : raw.book.updatedAt,
    };
}

export function summarizeBook(book: Book): RemoteBookSummary {
    return {
        id: book.id,
        name: book.name,
        updatedAt: book.updatedAt,
        currency: book.settings.currency,
        entryCount: book.entries.length,
    };
}

export function serializeRemoteBook(book: Book): string {
    const file: RemoteBookFile = {
        app: "liangqi",
        version: 1,
        // The remote copy should not carry a local connection binding.
        book: { ...book, remote: undefined },
        updatedAt: book.updatedAt,
    };
    return JSON.stringify(file, null, 2);
}

async function readIndex(
    adapter: RemoteAdapter,
): Promise<{ index: RemoteIndex; revision?: string }> {
    const file = await adapter.readFile(REMOTE_INDEX_PATH);
    if (!file) {
        return { index: emptyIndex() };
    }
    return { index: parseRemoteIndex(file.text), revision: file.revision };
}

async function updateIndex(adapter: RemoteAdapter, book: Book): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await readIndex(adapter);
        const summary = summarizeBook(book);
        const books = current.index.books.filter((item) => item.id !== book.id);
        books.push(summary);
        books.sort((a, b) => b.updatedAt - a.updatedAt);
        const next: RemoteIndex = {
            app: "liangqi",
            version: 1,
            books,
        };
        try {
            await adapter.writeFile(
                REMOTE_INDEX_PATH,
                JSON.stringify(next, null, 2),
                current.revision,
            );
            return;
        } catch (error) {
            if (error instanceof RemoteConflictError && attempt < 2) {
                continue;
            }
            throw error;
        }
    }
}

export class RemoteNewerError extends RemoteError {
    readonly remoteBook: Book;
    readonly revision?: string;

    constructor(remoteBook: Book, revision?: string) {
        super("远程账本比本地新，请先拉取远程数据", 409);
        this.name = "RemoteNewerError";
        this.remoteBook = remoteBook;
        this.revision = revision;
    }
}

export interface RemoteBookRecord {
    book: Book;
    revision?: string;
    updatedAt: number;
}

export async function testRemoteConnection(
    connection: Connection,
): Promise<{ defaultBranch?: string }> {
    const adapter = createRemoteAdapter(connection);
    return adapter.test();
}

export async function listRemoteBooks(
    connection: Connection,
): Promise<RemoteBookSummary[]> {
    const adapter = createRemoteAdapter(connection);
    const { index } = await readIndex(adapter);
    return index.books;
}

export async function pullRemoteBook(
    connection: Connection,
    bookId: string,
): Promise<RemoteBookRecord | null> {
    const adapter = createRemoteAdapter(connection);
    const file: RemoteFile | null = await adapter.readFile(remoteBookPath(bookId));
    if (!file) {
        return null;
    }
    const parsed = parseRemoteBookFile(file.text);
    return {
        book: parsed.book,
        revision: file.revision,
        updatedAt: parsed.updatedAt,
    };
}

export async function pushRemoteBook(
    connection: Connection,
    book: Book,
): Promise<{ revision?: string }> {
    const adapter = createRemoteAdapter(connection);
    const path = remoteBookPath(book.id);
    let current: RemoteFile | null = null;
    try {
        current = await adapter.readFile(path);
    } catch (error) {
        if (!(error instanceof RemoteError) || error.status !== 404) {
            throw error;
        }
    }

    if (current) {
        const remote = parseRemoteBookFile(current.text);
        if (remote.book.updatedAt > book.updatedAt) {
            throw new RemoteNewerError(remote.book, current.revision);
        }
    }

    try {
        const result = await adapter.writeFile(
            path,
            serializeRemoteBook(book),
            current?.revision,
        );
        await updateIndex(adapter, book);
        return { revision: result.revision };
    } catch (error) {
        if (error instanceof RemoteConflictError) {
            const latest = await adapter.readFile(path);
            if (latest) {
                const remote = parseRemoteBookFile(latest.text);
                throw new RemoteNewerError(remote.book, latest.revision);
            }
        }
        throw error;
    }
}
