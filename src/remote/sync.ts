/**
 * SPDX-License-Identifier: GPL-3.0-or-later
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
    RemoteNewerError,
} from "@/remote/repository";
import { RemoteError } from "@/remote/errors";

export type SyncAction = "push" | "pull" | "conflict" | "noop" | "local-only";

export interface SyncResult {
    action: SyncAction;
    book?: Book;
    message: string;
    revision?: string;
    manifest?: RemoteBookManifest;
}

function comparable(book: Book): string {
    return JSON.stringify({ ...book, remote: undefined, updatedAt: 0 });
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

export async function reconcileBook(
    connection: Connection,
    local: Book,
    binding: RemoteBinding,
): Promise<SyncResult> {
    const remote = await pullRemoteBook(connection, binding.remoteBookId);
    const last = binding.lastSyncedAt ?? 0;
    const localChanged = local.updatedAt > last;
    const remoteChanged = remote ? remote.book.updatedAt > last : false;

    if (!remote) {
        return {
            action: "push",
            message: "远程还没有这个账本，正在上传",
        };
    }

    if (remoteChanged && !localChanged) {
        return {
            action: "pull",
            book: remote.book,
            message: "已拉取远程更新",
            revision: remote.revision,
            manifest: remote.manifest,
        };
    }

    if (localChanged && !remoteChanged) {
        return {
            action: "push",
            message: "正在上传本地更新",
        };
    }

    if (localChanged && remoteChanged) {
        return {
            action: "conflict",
            book: remote.book,
            message: "本地和远程都有修改，按远程优先处理，并保留本地冲突备份",
            revision: remote.revision,
            manifest: remote.manifest,
        };
    }

    return {
        action: "noop",
        book: remote.book,
        message: "已是最新",
        revision: remote.revision,
        manifest: remote.manifest,
    };
}

export async function syncBookNow(bookId?: string): Promise<SyncResult> {
    const library = useLibraryStore.getState();
    const id = bookId ?? library.activeBookId;
    const book = library.books.find((item) => item.id === id);
    if (!book) {
        throw new RemoteError("账本不存在");
    }
    if (!book.remote) {
        return { action: "local-only", message: "这个账本还没有连接远程" };
    }
    const connection = getConnectionById(library, book.remote.connectionId);
    if (!connection) {
        return { action: "local-only", message: "远程连接配置已丢失，请重新连接" };
    }

    const result = await reconcileBook(connection, book, book.remote);

    if (result.action === "push") {
        try {
            const pushed = await pushRemoteBook(connection, book);
            const latest = latestBook(book.id, book);
            const syncedBook = withBinding(
                latest,
                connection,
                book.id,
                pushed.revision,
                book.updatedAt,
                latest.remote?.autoSync ?? book.remote.autoSync,
                pushed.manifest,
            );
            useLibraryStore.getState().upsertBook(syncedBook);
            if (useLibraryStore.getState().activeBookId === book.id) {
                useLedgerStore.setState({ remote: syncedBook.remote });
            }
            return {
                action: "push",
                book: syncedBook,
                revision: pushed.revision,
                manifest: pushed.manifest,
                message: "已上传到远程",
            };
        } catch (error) {
            if (error instanceof RemoteNewerError) {
                const latest = latestBook(book.id, book);
                saveConflictBackup(latest);
                const remoteBook = withBinding(
                    error.remoteBook,
                    connection,
                    book.id,
                    error.revision,
                    error.remoteBook.updatedAt,
                    latest.remote?.autoSync ?? book.remote.autoSync,
                );
                useLibraryStore.getState().upsertBook(remoteBook);
                if (useLibraryStore.getState().activeBookId === book.id) {
                    useLedgerStore.setState(remoteBook);
                }
                return {
                    action: "conflict",
                    book: remoteBook,
                    revision: error.revision,
                    message: "远程有更新的数据，已采用远程版本并保留本地备份",
                };
            }
            throw error;
        }
    }

    if (result.action === "pull" || result.action === "conflict") {
        const latest = latestBook(book.id, book);
        if (result.action === "conflict" || latest.updatedAt > book.updatedAt) {
            saveConflictBackup(latest);
        }
        const remoteBook = result.book;
        if (!remoteBook) {
            return { action: "noop", message: "远程没有可用数据" };
        }
        const syncedBook = withBinding(
            remoteBook,
            connection,
            book.id,
            result.revision,
            remoteBook.updatedAt,
            latest.remote?.autoSync ?? book.remote.autoSync,
            result.manifest,
        );
        useLibraryStore.getState().upsertBook(syncedBook);
        if (useLibraryStore.getState().activeBookId === book.id) {
            useLedgerStore.setState(syncedBook);
        }
        return {
            ...result,
            book: syncedBook,
        };
    }

    if (result.action === "noop" && result.book) {
        const latest = latestBook(book.id, book);
        const syncedBook = withBinding(
            latest,
            connection,
            book.id,
            result.revision,
            result.book.updatedAt,
            latest.remote?.autoSync ?? book.remote.autoSync,
            result.manifest,
        );
        useLibraryStore.getState().upsertBook(syncedBook);
        if (useLibraryStore.getState().activeBookId === book.id) {
            useLedgerStore.setState({ remote: syncedBook.remote });
        }
        return { ...result, book: syncedBook };
    }

    return result;
}

export async function openRemoteBook(
    connection: Connection,
    remoteBookId: string,
): Promise<Book> {
    const remote = await pullRemoteBook(connection, remoteBookId);
    if (!remote) {
        throw new RemoteError("远程账本不存在");
    }
    const library = useLibraryStore.getState();
    const existing = library.books.find((book) => book.id === remote.book.id);
    if (existing && comparable(existing) !== comparable(remote.book)) {
        saveConflictBackup(existing);
    }
    const localBook = withBinding(
        remote.book,
        connection,
        remoteBookId,
        remote.revision,
        remote.book.updatedAt,
        true,
        remote.manifest,
    );
    library.upsertBook(localBook);
    activateBook(localBook.id);
    setActiveBookRemote(localBook.id, localBook.remote);
    return localBook;
}

export async function uploadCurrentBook(
    connection: Connection,
): Promise<SyncResult> {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    if (!book) {
        throw new RemoteError("没有当前账本");
    }
    try {
        const pushed = await pushRemoteBook(connection, book);
        const latest = latestBook(book.id, book);
        const bound = withBinding(
            latest,
            connection,
            book.id,
            pushed.revision,
            book.updatedAt,
            true,
            pushed.manifest,
        );
        useLibraryStore.getState().upsertBook(bound);
        useLedgerStore.setState({ remote: bound.remote });
        return {
            action: "push",
            book: bound,
            revision: pushed.revision,
            manifest: pushed.manifest,
            message: "当前账本已上传，并绑定到这个仓库",
        };
    } catch (error) {
        if (error instanceof RemoteNewerError) {
            const latest = latestBook(book.id, book);
            saveConflictBackup(latest);
            const remoteBook = withBinding(
                error.remoteBook,
                connection,
                book.id,
                error.revision,
                error.remoteBook.updatedAt,
                true,
            );
            useLibraryStore.getState().upsertBook(remoteBook);
            useLedgerStore.setState(remoteBook);
            return {
                action: "conflict",
                book: remoteBook,
                revision: error.revision,
                message: "远程已有同名账本且更新，已采用远程版本并保留本地备份",
            };
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
