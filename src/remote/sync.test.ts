/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    Book,
    Connection,
    RemoteBookManifest,
} from "@/types";
import { createSeedBook } from "@/domain/seed";
import { useLibraryStore } from "@/store/library";
import { useLedgerStore } from "@/store/ledger";
import { openRemoteBook } from "@/remote/sync";
import {
    pullRemoteBook,
    pushRemoteBook,
    type RemoteBookRecord,
} from "@/remote/repository";
import { saveConflictBackup } from "@/remote/conflicts";

vi.mock("@/remote/repository", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/remote/repository")>();
    return {
        ...actual,
        pullRemoteBook: vi.fn(),
        pushRemoteBook: vi.fn(),
        readRemoteManifest: vi.fn(),
    };
});

vi.mock("@/remote/conflicts", () => ({
    saveConflictBackup: vi.fn(),
}));

vi.mock("@/remote/attachments", () => ({
    uploadPendingAttachments: vi.fn().mockImplementation(
        async (_connection: unknown, attachments: unknown) => attachments,
    ),
}));

const NOW = new Date(2026, 10, 4, 12).getTime();

const connection: Connection = {
    id: "conn_1",
    provider: "github",
    label: "GitHub · owner/repo",
    owner: "owner",
    repo: "repo",
    token: "token",
    createdAt: NOW,
};

function manifest(bookId: string, name: string): RemoteBookManifest {
    return {
        app: "liangqi",
        version: 2,
        bookId,
        name,
        updatedAt: NOW,
        currency: "CNY",
        entryCount: 1,
        billCount: 0,
        metaHash: "hash",
        chunks: { entries: [], bills: [] },
    };
}

function localBook(): Book {
    const book = createSeedBook("本地账本", NOW);
    book.id = "local_book";
    book.entries.push({
        id: "local_entry",
        kind: "expense",
        amount: 1_000,
        date: NOW,
        accountId: "acc_cash",
        categoryId: "cat_food",
        createdAt: NOW,
    });
    return book;
}

function remoteBook(): Book {
    const book = createSeedBook("共享账本", NOW);
    book.id = "remote_book";
    book.entries.push({
        id: "remote_entry",
        kind: "expense",
        amount: 2_000,
        date: NOW,
        accountId: "acc_bank",
        categoryId: "cat_food",
        createdAt: NOW,
    });
    return book;
}

function setup(): { local: Book; remote: Book } {
    const local = localBook();
    const remote = remoteBook();
    useLibraryStore.setState({
        version: 2,
        books: [local],
        activeBookId: local.id,
        connections: [connection],
    });
    useLedgerStore.setState(local);
    vi.mocked(pullRemoteBook).mockResolvedValue({
        book: remote,
        revision: "remote-revision",
        updatedAt: NOW,
        manifest: manifest(remote.id, remote.name),
    } satisfies RemoteBookRecord);
    vi.mocked(pushRemoteBook).mockResolvedValue({
        revision: "merged-revision",
        manifest: manifest(remote.id, remote.name),
    });
    return { local, remote };
}

describe("openRemoteBook merge commit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("merges a different local book into the remote book and removes the old id", async () => {
        setup();

        const opened = await openRemoteBook(connection, "remote_book");

        expect(opened.id).toBe("remote_book");
        expect(opened.entries.map((entry) => entry.id).sort()).toEqual([
            "local_entry",
            "remote_entry",
        ]);
        expect(pushRemoteBook).toHaveBeenCalledOnce();
        expect(saveConflictBackup).toHaveBeenCalledOnce();

        const library = useLibraryStore.getState();
        expect(library.books.map((book) => book.id)).toEqual(["remote_book"]);
        expect(library.activeBookId).toBe("remote_book");
        expect(library.books[0].remote?.remoteBookId).toBe("remote_book");
        expect(useLedgerStore.getState().id).toBe("remote_book");
    });

    it("leaves the local library untouched when the remote push fails", async () => {
        setup();
        vi.mocked(pushRemoteBook).mockRejectedValueOnce(new Error("network down"));

        await expect(openRemoteBook(connection, "remote_book")).rejects.toThrow(
            "network down",
        );

        const library = useLibraryStore.getState();
        expect(library.books.map((book) => book.id)).toEqual(["local_book"]);
        expect(library.activeBookId).toBe("local_book");
        expect(useLedgerStore.getState().id).toBe("local_book");
    });
});
