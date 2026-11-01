/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    Bill,
    Book,
    Entry,
    RemoteBookManifest,
    RemoteBookMetaFile,
    RemoteChunkRef,
} from "@/types";
import { remoteChunkPath } from "@/remote/paths";
import { RemoteError } from "@/remote/errors";
import { ensureRepaymentCategories } from "@/domain/ledger";

export const CHUNK_SIZE = 1000;

export interface BuiltChunk {
    path: string;
    text: string;
    ref: RemoteChunkRef;
}

export interface RemotePayload {
    metaText: string;
    metaHash: string;
    entries: BuiltChunk[];
    bills: BuiltChunk[];
    manifest: RemoteBookManifest;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function hashText(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function buildChunks<T>(
    bookId: string,
    kind: "entries" | "bills",
    items: T[],
): Promise<BuiltChunk[]> {
    const chunks: BuiltChunk[] = [];
    for (let start = 0; start < items.length; start += CHUNK_SIZE) {
        const slice = items.slice(start, start + CHUNK_SIZE);
        const text = JSON.stringify(slice);
        chunks.push({
            path: remoteChunkPath(bookId, kind, start),
            text,
            ref: {
                path: remoteChunkPath(bookId, kind, start),
                start,
                count: slice.length,
                hash: await hashText(text),
            },
        });
    }
    return chunks;
}

export function bookMeta(book: Book): Omit<Book, "entries" | "bills" | "remote"> {
    return {
        id: book.id,
        name: book.name,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        accounts: book.accounts,
        categories: book.categories,
        members: book.members,
        tagGroups: book.tagGroups,
        tags: book.tags,
        budgets: book.budgets,
        recurringRules: book.recurringRules,
        attachments: book.attachments,
        deletedEntries: book.deletedEntries,
        deletedBills: book.deletedBills,
        deletedConfig: book.deletedConfig,
        settings: book.settings,
    };
}

export async function buildRemotePayload(book: Book): Promise<RemotePayload> {
    const metaText = JSON.stringify(
        {
            app: "liangqi",
            version: 2,
            book: bookMeta(book),
        } satisfies RemoteBookMetaFile,
        null,
        2,
    );
    const metaHash = await hashText(metaText);
    const [entries, bills] = await Promise.all([
        buildChunks(book.id, "entries", book.entries),
        buildChunks(book.id, "bills", book.bills),
    ]);

    return {
        metaText,
        metaHash,
        entries,
        bills,
        manifest: {
            app: "liangqi",
            version: 2,
            bookId: book.id,
            name: book.name,
            updatedAt: book.updatedAt,
            currency: book.settings.currency,
            entryCount: book.entries.length,
            billCount: book.bills.length,
            metaHash,
            chunks: {
                entries: entries.map((chunk) => chunk.ref),
                bills: bills.map((chunk) => chunk.ref),
            },
        },
    };
}

export function parseManifest(text: string): RemoteBookManifest {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new RemoteError("远程 manifest.json 不是合法 JSON");
    }
    if (!isObject(raw) || raw.app !== "liangqi" || raw.version !== 2) {
        throw new RemoteError("远程 manifest.json 格式不正确");
    }
    if (!isObject(raw.chunks)) {
        throw new RemoteError("远程 manifest.json 缺少分片信息");
    }
    const parseRefs = (value: unknown): RemoteChunkRef[] => {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .filter(
                (item): item is RemoteChunkRef =>
                    isObject(item) &&
                    typeof item.path === "string" &&
                    typeof item.start === "number" &&
                    typeof item.count === "number" &&
                    typeof item.hash === "string",
            )
            .map((item) => ({ ...item }));
    };
    return {
        app: "liangqi",
        version: 2,
        bookId: String(raw.bookId ?? ""),
        name: String(raw.name ?? ""),
        updatedAt: Number(raw.updatedAt ?? 0),
        currency: String(raw.currency ?? "CNY"),
        entryCount: Number(raw.entryCount ?? 0),
        billCount: Number(raw.billCount ?? 0),
        metaHash: String(raw.metaHash ?? ""),
        chunks: {
            entries: parseRefs(raw.chunks.entries),
            bills: parseRefs(raw.chunks.bills),
        },
    };
}

export function parseMetaFile(text: string): RemoteBookMetaFile {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new RemoteError("远程 meta.json 不是合法 JSON");
    }
    if (!isObject(raw) || raw.app !== "liangqi" || raw.version !== 2) {
        throw new RemoteError("远程 meta.json 格式不正确");
    }
    if (!isObject(raw.book)) {
        throw new RemoteError("远程 meta.json 缺少账本数据");
    }
    return raw as unknown as RemoteBookMetaFile;
}

export function parseChunkFile<T>(text: string): T[] {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new RemoteError("远程分片不是合法 JSON");
    }
    if (!Array.isArray(raw)) {
        throw new RemoteError("远程分片不是数组");
    }
    return raw as T[];
}

export function bookFromParts(
    meta: RemoteBookMetaFile,
    entries: Entry[],
    bills: Bill[],
): Book {
    return ensureRepaymentCategories({
        ...meta.book,
        entries,
        bills,
    });
}
