/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RemoteBinding } from "@/types";
import { useLedgerStore } from "@/store/ledger";
import { useLibraryStore } from "@/store/library";

export function activateBook(bookId: string): boolean {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === bookId);
    if (!book) {
        return false;
    }
    library.setActiveBookId(book.id);
    useLedgerStore.setState(book);
    return true;
}

export function createAndActivateBook(name: string): string {
    const book = useLibraryStore.getState().createBook(name);
    useLedgerStore.setState(book);
    return book.id;
}

export function renameBook(bookId: string, name: string): boolean {
    const library = useLibraryStore.getState();
    const activeId = library.activeBookId;
    if (!library.renameBook(bookId, name)) {
        return false;
    }
    if (bookId === activeId) {
        useLedgerStore.setState({ name: name.trim() });
    }
    return true;
}

export function deleteBook(bookId: string): boolean {
    const library = useLibraryStore.getState();
    const wasActive = library.activeBookId === bookId;
    const nextActiveId = library.deleteBook(bookId);
    if (nextActiveId === false) {
        return false;
    }
    if (wasActive) {
        activateBook(nextActiveId);
    }
    return true;
}

export function setActiveBookRemote(
    bookId: string,
    remote: RemoteBinding | undefined,
): void {
    const library = useLibraryStore.getState();
    library.setBookRemote(bookId, remote);
    if (library.activeBookId === bookId) {
        useLedgerStore.setState({ remote });
    }
}
