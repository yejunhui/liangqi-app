/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection } from "@/types";
import { createSeedBook } from "@/domain/seed";
import type { RemoteAdapter } from "@/remote/adapter";

const state = vi.hoisted(() => ({
    files: new Map<string, string>(),
    adapter: null as RemoteAdapter | null,
}));

vi.mock("@/remote/index", () => ({
    createRemoteAdapter: () => {
        if (!state.adapter) {
            throw new Error("mock adapter not ready");
        }
        return state.adapter;
    },
}));

import {
    listRemoteBooks,
    pullRemoteBook,
    pushRemoteBook,
} from "@/remote/repository";

const NOW = new Date(2026, 9, 31, 12).getTime();

const connection: Connection = {
    id: "conn_mock",
    provider: "webdav",
    label: "mock",
    createdAt: NOW,
    url: "https://dav.example.com/ledger/",
};

beforeEach(() => {
    state.files.clear();
    state.adapter = {
        provider: "webdav",
        async test() {
            return {};
        },
        async readFile(path) {
            const text = state.files.get(path);
            return text === undefined ? null : { text, revision: `rev:${path}` };
        },
        async writeFile(path, text) {
            state.files.set(path, text);
            return { revision: `rev:${path}` };
        },
        async ensureDirectory() {},
    };
});

describe("one repository one ledger", () => {
    it("pushes the new root layout without an index", async () => {
        const book = createSeedBook("共享账本", NOW);
        book.entries.push({
            id: "entry_1",
            kind: "expense",
            amount: 1200,
            date: NOW,
            accountId: "acc_cash",
            categoryId: "cat_food",
            ownerId: "github:1",
            ownerName: "Alice",
            updatedAt: NOW,
            createdAt: NOW,
        });

        const pushed = await pushRemoteBook(connection, book);
        expect(pushed.manifest.bookId).toBe(book.id);
        expect(state.files.has("liangqi/meta.json")).toBe(true);
        expect(state.files.has("liangqi/manifest.json")).toBe(true);
        expect(state.files.has("liangqi/entries-0.json")).toBe(true);
        expect(state.files.has("liangqi/index.json")).toBe(false);

        const summaries = await listRemoteBooks(connection);
        expect(summaries).toHaveLength(1);
        expect(summaries[0]).toMatchObject({
            id: book.id,
            name: "共享账本",
            entryCount: 1,
        });

        const pulled = await pullRemoteBook(connection, book.id);
        expect(pulled?.book.entries).toHaveLength(1);
        expect(pulled?.book.entries[0].ownerName).toBe("Alice");
    });

    it("keeps the manifest available for incremental sync", async () => {
        const book = createSeedBook("共享账本", NOW);
        await pushRemoteBook(connection, book);
        const manifest = state.files.get("liangqi/manifest.json");
        expect(manifest).toContain('"bookId"');
        expect(JSON.parse(manifest ?? "{}")).toMatchObject({
            bookId: book.id,
            entryCount: 0,
        });
    });
});
