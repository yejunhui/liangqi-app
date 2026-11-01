/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
    legacyRemoteBookManifestPath,
    legacyRemoteBookMetaPath,
    legacyRemoteChunkPath,
    remoteBookManifestPath,
    remoteBookMetaPath,
    remoteChunkPath,
} from "@/remote/paths";

describe("remote layout", () => {
    it("stores one book at the repo root", () => {
        expect(remoteBookMetaPath("book_1")).toBe("liangqi/meta.json");
        expect(remoteBookManifestPath("book_1")).toBe("liangqi/manifest.json");
        expect(remoteChunkPath("book_1", "entries", 2000)).toBe(
            "liangqi/entries-2000.json",
        );
        expect(remoteChunkPath("another", "bills", 0)).toBe(
            "liangqi/bills-0.json",
        );
    });

    it("keeps legacy paths for migration", () => {
        expect(legacyRemoteBookMetaPath("book_1")).toBe(
            "liangqi/books/book_1/meta.json",
        );
        expect(legacyRemoteBookManifestPath("book_1")).toBe(
            "liangqi/books/book_1/manifest.json",
        );
        expect(legacyRemoteChunkPath("book_1", "entries", 0)).toBe(
            "liangqi/books/book_1/entries-0.json",
        );
    });
});
