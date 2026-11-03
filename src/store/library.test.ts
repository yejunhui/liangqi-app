/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createSeedBook } from "@/domain/seed";
import { useLibraryStore } from "@/store/library";

const NOW = new Date(2026, 10, 4, 12).getTime();

describe("library remote merge commit", () => {
    beforeEach(() => {
        const local = createSeedBook("Local", NOW);
        local.id = "book_local";
        const other = createSeedBook("Other", NOW);
        other.id = "book_other";
        useLibraryStore.setState({
            version: 2,
            books: [local, other],
            activeBookId: local.id,
            connections: [],
        });
    });

    it("replaces the local book and activates the remote book atomically", () => {
        const merged = createSeedBook("Remote", NOW);
        merged.id = "book_remote";
        merged.remote = {
            connectionId: "conn_1",
            remoteBookId: "book_remote",
            lastSyncedAt: NOW,
            autoSync: true,
        };

        useLibraryStore
            .getState()
            .replaceBookAndActivate(merged, "book_local");

        const state = useLibraryStore.getState();
        expect(state.books.map((book) => book.id)).toEqual([
            "book_other",
            "book_remote",
        ]);
        expect(state.activeBookId).toBe("book_remote");
        expect(state.books.find((book) => book.id === "book_remote")?.remote).toEqual(
            merged.remote,
        );
    });
});
