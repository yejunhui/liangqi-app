/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    Bill,
    Book,
    Connection,
    Entry,
    RemoteBookFile,
    RemoteBookManifest,
    RemoteBookSummary,
    RemoteIndex,
    RemoteChunkRef,
} from "@/types";
import { createRemoteAdapter } from "@/remote/index";
import { ensureMembers } from "@/domain/members";
import {
    REMOTE_INDEX_PATH,
    remoteBookManifestPath,
    remoteBookMetaPath,
    remoteBookPath,
} from "@/remote/paths";
import { RemoteConflictError, RemoteError } from "@/remote/errors";
import type { RemoteAdapter, RemoteFile } from "@/remote/adapter";
import {
    buildRemotePayload,
    bookFromParts,
    parseChunkFile,
    parseManifest,
    parseMetaFile,
} from "@/remote/chunks";

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

/** Legacy single-file format (v1), kept for migration. */
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
    manifest?: RemoteBookManifest;
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

async function readChunks<T>(
    adapter: RemoteAdapter,
    refs: RemoteChunkRef[],
): Promise<T[]> {
    const texts = await Promise.all(
        refs.map(async (ref) => {
            const file = await adapter.readFile(ref.path);
            if (!file) {
                throw new RemoteError(`缺少远程分片 ${ref.path}`);
            }
            return file.text;
        }),
    );
    return texts.flatMap((text) => parseChunkFile<T>(text));
}

export async function pullRemoteBook(
    connection: Connection,
    bookId: string,
): Promise<RemoteBookRecord | null> {
    const adapter = createRemoteAdapter(connection);

    const manifestFile = await adapter.readFile(remoteBookManifestPath(bookId));
    if (manifestFile) {
        const manifest = parseManifest(manifestFile.text);
        const metaFile = await adapter.readFile(remoteBookMetaPath(bookId));
        if (!metaFile) {
            throw new RemoteError("远程账本缺少 meta.json");
        }
        const meta = parseMetaFile(metaFile.text);
        const [entries, bills] = await Promise.all([
            readChunks<Entry>(adapter, manifest.chunks.entries),
            readChunks<Bill>(adapter, manifest.chunks.bills),
        ]);
        if (
            entries.length !== manifest.entryCount ||
            bills.length !== manifest.billCount
        ) {
            throw new RemoteError("远程分片数量与 manifest 不一致");
        }
        const book = ensureMembers(bookFromParts(meta, entries, bills));
        return {
            book,
            revision: manifestFile.revision,
            updatedAt: manifest.updatedAt,
            manifest,
        };
    }

    // Legacy v1: one full JSON file per book.
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

function changedChunks(
    current: RemoteChunkRef[] | undefined,
    next: RemoteChunkRef[],
): RemoteChunkRef[] {
    const currentMap = new Map(
        (current ?? []).map((chunk) => [chunk.path, chunk.hash]),
    );
    return next.filter((chunk) => currentMap.get(chunk.path) !== chunk.hash);
}

export async function pushRemoteBook(
    connection: Connection,
    book: Book,
): Promise<{ revision?: string; manifest: RemoteBookManifest }> {
    const adapter = createRemoteAdapter(connection);
    const manifestPath = remoteBookManifestPath(book.id);
    const metaPath = remoteBookMetaPath(book.id);

    let currentManifest: RemoteBookManifest | null = null;
    const currentFile = await adapter.readFile(manifestPath);
    if (currentFile) {
        currentManifest = parseManifest(currentFile.text);
        if (currentManifest.updatedAt > book.updatedAt) {
            const remote = await pullRemoteBook(connection, book.id);
            if (remote) {
                throw new RemoteNewerError(remote.book, remote.revision);
            }
        }
    } else {
        // Migration path: do not overwrite a newer legacy single-file book.
        const legacyFile = await adapter.readFile(remoteBookPath(book.id));
        if (legacyFile) {
            const legacy = parseRemoteBookFile(legacyFile.text);
            if (legacy.book.updatedAt > book.updatedAt) {
                throw new RemoteNewerError(legacy.book, legacyFile.revision);
            }
        }
    }

    const payload = await buildRemotePayload(book);
    const files: Array<{ path: string; text: string | null }> = [];

    if (!currentManifest || currentManifest.metaHash !== payload.metaHash) {
        files.push({ path: metaPath, text: payload.metaText });
    }

    const changedEntries = changedChunks(
        currentManifest?.chunks.entries,
        payload.manifest.chunks.entries,
    );
    const changedBills = changedChunks(
        currentManifest?.chunks.bills,
        payload.manifest.chunks.bills,
    );
    for (const chunk of [...payload.entries, ...payload.bills]) {
        if (
            changedEntries.some((ref) => ref.path === chunk.path) ||
            changedBills.some((ref) => ref.path === chunk.path)
        ) {
            files.push({ path: chunk.path, text: chunk.text });
        }
    }

    // Batch-capable adapters can also remove chunks that no longer exist.
    if (currentManifest && adapter.writeFiles) {
        const nextPaths = new Set(
            [
                ...payload.manifest.chunks.entries,
                ...payload.manifest.chunks.bills,
            ].map((chunk) => chunk.path),
        );
        for (const ref of [
            ...currentManifest.chunks.entries,
            ...currentManifest.chunks.bills,
        ]) {
            if (!nextPaths.has(ref.path)) {
                files.push({ path: ref.path, text: null });
            }
        }
    }

    files.push({
        path: manifestPath,
        text: JSON.stringify(payload.manifest, null, 2),
    });

    try {
        if (adapter.writeFiles) {
            await adapter.writeFiles(files, `liangqi: sync ${book.name}`);
        } else {
            for (const file of files) {
                if (file.text !== null) {
                    await adapter.writeFile(file.path, file.text);
                }
            }
        }
        await updateIndex(adapter, book);
    } catch (error) {
        if (error instanceof RemoteConflictError) {
            const remote = await pullRemoteBook(connection, book.id);
            if (remote) {
                throw new RemoteNewerError(remote.book, remote.revision);
            }
        }
        throw error;
    }

    const writtenManifest = await adapter.readFile(manifestPath);
    return {
        revision: writtenManifest?.revision,
        manifest: payload.manifest,
    };
}
