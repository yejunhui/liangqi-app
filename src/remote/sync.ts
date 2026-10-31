/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * One repository = one shared ledger. Sync pulls the remote copy, merges it
 * per record with the local copy, then pushes only if the merged result really
 * differs from what the server already has.
 */

import type { Book, Connection, RemoteBinding, RemoteBookManifest } from "@/types";
import {
    getConnectionById,
    useLibraryStore,
} from "@/store/library";
import { useLedgerStore } from "@/store/ledger";
import { activateBook, setActiveBookRemote } from "@/store/book-actions";
import { saveConflictBackup } from "@/remote/conflicts";
import {
    pullRemoteBook,
    pushRemoteBook,
    readRemoteManifest,
    RemoteNewerError,
} from "@/remote/repository";
import {
    bookContentSignature,
    claimUnownedRecords,
    mergeBooks,
} from "@/domain/merge";
import { RemoteError } from "@/remote/errors";
import { getMemberForBook, useMemberSessionStore } from "@/store/member-session";
import { uploadPendingAttachments } from "@/remote/attachments";

export type SyncAction = "push" | "pull" | "conflict" | "noop" | "local-only";

export interface SyncResult {
    action: SyncAction;
    book?: Book;
    message: string;
    revision?: string;
    manifest?: RemoteBookManifest;
}

function withBinding(
    book: Book,
    connection: Connection,
    remoteBookId: string,
    revision: string | undefined,
    lastSyncedAt: number,
    autoSync = true,
    manifest?: RemoteBookManifest,
): Book {
    const binding: RemoteBinding = {
        connectionId: connection.id,
        remoteBookId,
        revision,
        lastSyncedAt,
        autoSync,
        manifest,
    };
    return { ...book, remote: binding };
}

function latestBook(bookId: string, fallback: Book): Book {
    return (
        useLibraryStore.getState().books.find((book) => book.id === bookId) ?? fallback
    );
}

export function getActiveBinding(): {
    book: Book;
    connection: Connection;
    binding: RemoteBinding;
} | null {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    if (!book?.remote) {
        return null;
    }
    const connection = getConnectionById(library, book.remote.connectionId);
    if (!connection) {
        return null;
    }
    return { book, connection, binding: book.remote };
}

function mergeForUser(
    local: Book,
    remote: Book | undefined,
    _connection: Connection,
): Book {
    const actor = getMemberForBook(local);
    const base = remote ? mergeBooks(local, remote) : local;
    return {
        ...(actor ? claimUnownedRecords(base, actor) : base),
        id: local.id,
        name: local.name || base.name,
        createdAt: Math.min(local.createdAt, base.createdAt),
        remote: local.remote,
    };
}

function applyBook(
    book: Book,
    connection: Connection,
    revision: string | undefined,
    lastSyncedAt: number,
    manifest?: RemoteBookManifest,
): Book {
    const syncedBook = withBinding(
        book,
        connection,
        book.id,
        revision,
        lastSyncedAt,
        book.remote?.autoSync ?? true,
        manifest,
    );
    useLibraryStore.getState().upsertBook(syncedBook);
    if (useLibraryStore.getState().activeBookId === book.id) {
        useLedgerStore.setState(syncedBook);
    }
    return syncedBook;
}

async function pushWithRetry(
    connection: Connection,
    book: Book,
    remote: Book | undefined,
): Promise<{
    book: Book;
    revision?: string;
    manifest: RemoteBookManifest;
    merged: boolean;
}> {
    let candidate = book;
    let remoteCopy = remote;
    let merged = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const withAttachments = await uploadPendingAttachments(
            connection,
            candidate.attachments,
        );
        const prepared = { ...candidate, attachments: withAttachments };
        const toPush = {
            ...prepared,
            updatedAt: Math.max(
                Date.now(),
                prepared.updatedAt,
                remoteCopy?.updatedAt ?? 0,
            ),
        };
        try {
            const pushed = await pushRemoteBook(connection, toPush);
            return {
                book: toPush,
                revision: pushed.revision,
                manifest: pushed.manifest,
                merged,
            };
        } catch (error) {
            lastError = error;
            if (!(error instanceof RemoteNewerError)) {
                throw error;
            }
            saveConflictBackup(toPush);
            remoteCopy = error.remoteBook;
            candidate = mergeForUser(toPush, error.remoteBook, connection);
            merged = true;
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new RemoteError("多个用户同时同步，暂时无法合并，请稍后重试");
}

export async function syncBookNow(bookId?: string): Promise<SyncResult> {
    const library = useLibraryStore.getState();
    const id = bookId ?? library.activeBookId;
    let book = library.books.find((item) => item.id === id);
    if (!book) {
        throw new RemoteError("账本不存在");
    }
    if (!book.remote) {
        return { action: "local-only", message: "这个账本还没有连接远程" };
    }
    const binding = book.remote;
    const connection = getConnectionById(library, binding.connectionId);
    if (!connection) {
        return { action: "local-only", message: "远程连接配置已丢失，请重新连接" };
    }

    const last = binding.lastSyncedAt ?? 0;
    const manifestRecord = await readRemoteManifest(connection, binding.remoteBookId);
    const needsLayoutMigration = manifestRecord?.layout !== "current";

    if (
        manifestRecord?.layout === "current" &&
        manifestRecord.manifest.updatedAt === last &&
        book.updatedAt <= last
    ) {
        const synced = applyBook(
            book,
            connection,
            manifestRecord.revision,
            manifestRecord.manifest.updatedAt,
            manifestRecord.manifest,
        );
        return {
            action: "noop",
            book: synced,
            message: "已是最新",
            revision: manifestRecord.revision,
            manifest: manifestRecord.manifest,
        };
    }

    if (
        manifestRecord?.layout === "current" &&
        manifestRecord.manifest.updatedAt === last &&
        book.updatedAt > last
    ) {
        const claimed = mergeForUser(book, undefined, connection);
        const pushed = await pushWithRetry(connection, claimed, undefined);
        const synced = applyBook(
            pushed.book,
            connection,
            pushed.revision,
            pushed.book.updatedAt,
            pushed.manifest,
        );
        return {
            action: "push",
            book: synced,
            message: "已上传本地更新",
            revision: pushed.revision,
            manifest: pushed.manifest,
        };
    }

    const remote = await pullRemoteBook(connection, binding.remoteBookId);
    if (!remote) {
        const claimed = mergeForUser(book, undefined, connection);
        const pushed = await pushWithRetry(connection, claimed, undefined);
        const synced = applyBook(
            pushed.book,
            connection,
            pushed.revision,
            pushed.book.updatedAt,
            pushed.manifest,
        );
        return {
            action: "push",
            book: synced,
            message: "远程还没有这个账本，已上传",
            revision: pushed.revision,
            manifest: pushed.manifest,
        };
    }

    const localChanged = book.updatedAt > last;
    if (localChanged) {
        saveConflictBackup(book);
    }
    const merged = mergeForUser(book, remote.book, connection);
    if (
        !needsLayoutMigration &&
        bookContentSignature(merged) === bookContentSignature(remote.book)
    ) {
        const synced = applyBook(
            merged,
            connection,
            remote.revision,
            remote.book.updatedAt,
            remote.manifest,
        );
        return {
            action: "pull",
            book: synced,
            message: "已拉取远程更新并合并",
            revision: remote.revision,
            manifest: remote.manifest,
        };
    }

    const pushed = await pushWithRetry(connection, merged, remote.book);
    const synced = applyBook(
        pushed.book,
        connection,
        pushed.revision,
        pushed.book.updatedAt,
        pushed.manifest,
    );
    return {
        action: "push",
        book: synced,
        message: "已合并远程和本地更新",
        revision: pushed.revision,
        manifest: pushed.manifest,
    };
}

export async function openRemoteBook(
    connection: Connection,
    remoteBookId?: string,
): Promise<Book> {
    const remote = await pullRemoteBook(connection, remoteBookId ?? "");
    if (!remote) {
        throw new RemoteError("远程账本不存在");
    }
    const library = useLibraryStore.getState();
    const existing = library.books.find((book) => book.id === remote.book.id);
    let localBook: Book;
    if (existing && bookContentSignature(existing) !== bookContentSignature(remote.book)) {
        saveConflictBackup(existing);
        const merged = mergeForUser(existing, remote.book, connection);
        const pushed =
            bookContentSignature(merged) === bookContentSignature(remote.book)
                ? {
                      book: merged,
                      revision: remote.revision,
                      manifest: remote.manifest,
                  }
                : await pushWithRetry(connection, merged, remote.book);
        localBook = withBinding(
            pushed.book,
            connection,
            pushed.book.id,
            pushed.revision,
            pushed.book.updatedAt,
            true,
            pushed.manifest,
        );
    } else {
        localBook = withBinding(
            remote.book,
            connection,
            remote.book.id,
            remote.revision,
            remote.book.updatedAt,
            true,
            remote.manifest,
        );
    }
    useLibraryStore.getState().upsertBook(localBook);
    activateBook(localBook.id);
    setActiveBookRemote(localBook.id, localBook.remote);
    return localBook;
}

export async function uploadCurrentBook(connection: Connection): Promise<SyncResult> {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    if (!book) {
        throw new RemoteError("没有当前账本");
    }
    const existingRemote = await pullRemoteBook(connection, book.id);
    if (existingRemote) {
        throw new RemoteError("这个仓库已经有一本账，请直接打开共享账本");
    }
    const actor = getMemberForBook(book);
    if (!actor) {
        throw new RemoteError("请先选择当前记账成员，再上传账本");
    }
    const claimed = claimUnownedRecords(book, actor);
    try {
        const pushed = await pushRemoteBook(connection, claimed);
        const bound = withBinding(
            claimed,
            connection,
            claimed.id,
            pushed.revision,
            claimed.updatedAt,
            true,
            pushed.manifest,
        );
        useLibraryStore.getState().upsertBook(bound);
        useLedgerStore.setState(bound);
        useMemberSessionStore.getState().setActiveMember(bound.id, actor.id);
        return {
            action: "push",
            book: bound,
            revision: pushed.revision,
            manifest: pushed.manifest,
            message: "当前账本已上传到这个仓库",
        };
    } catch (error) {
        if (error instanceof RemoteNewerError) {
            const latest = latestBook(book.id, book);
            saveConflictBackup(latest);
            throw new RemoteError("远程已经有账本，请重新打开共享账本");
        }
        throw error;
    }
}

export function disconnectBook(bookId?: string): void {
    const library = useLibraryStore.getState();
    const id = bookId ?? library.activeBookId;
    library.setBookRemote(id, undefined);
    if (library.activeBookId === id) {
        useLedgerStore.setState({ remote: undefined });
    }
}
