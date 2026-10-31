/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGitContentsAdapter } from "@/remote/git-contents";

const fetchMock = vi.fn<typeof fetch>();

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

describe("GitHub batch writer", () => {
    it("writes multiple files through blob, tree, commit and ref APIs", async () => {
        let blobIndex = 0;
        fetchMock.mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            if (url.endsWith("/git/ref/heads/main") && method === "GET") {
                return json({ object: { sha: "commit-1" } });
            }
            if (url.endsWith("/git/commits/commit-1") && method === "GET") {
                return json({ tree: { sha: "tree-1" } });
            }
            if (url.endsWith("/git/blobs") && method === "POST") {
                blobIndex += 1;
                return json({ sha: `blob-${blobIndex}` });
            }
            if (url.endsWith("/git/trees") && method === "POST") {
                return json({ sha: "tree-2" });
            }
            if (url.endsWith("/git/commits") && method === "POST") {
                return json({ sha: "commit-2" });
            }
            if (url.endsWith("/git/refs/heads/main") && method === "PATCH") {
                return json({ ok: true });
            }
            return json({ message: `unexpected ${method} ${url}` }, 500);
        });

        const adapter = createGitContentsAdapter({
            provider: "github",
            owner: "me",
            repo: "ledger",
            branch: "main",
            token: "tok",
        });
        expect(adapter.writeFiles).toBeTypeOf("function");

        await adapter.writeFiles?.(
            [
                { path: "liangqi/books/book_1/meta.json", text: "{\"a\":1}" },
                { path: "liangqi/books/book_1/entries-0.json", text: "[]" },
                { path: "liangqi/books/book_1/old.json", text: null },
            ],
            "liangqi: sync",
        );

        const treeCall = fetchMock.mock.calls.find(
            ([url, init]) =>
                String(url).endsWith("/git/trees") && init?.method === "POST",
        );
        expect(treeCall).toBeDefined();
        const treeBody = JSON.parse(String(treeCall?.[1]?.body));
        expect(treeBody.base_tree).toBe("tree-1");
        expect(treeBody.tree).toEqual([
            {
                path: "liangqi/books/book_1/meta.json",
                mode: "100644",
                type: "blob",
                sha: "blob-1",
            },
            {
                path: "liangqi/books/book_1/entries-0.json",
                mode: "100644",
                type: "blob",
                sha: "blob-2",
            },
            {
                path: "liangqi/books/book_1/old.json",
                mode: "100644",
                type: "blob",
                sha: null,
            },
        ]);

        const commitCall = fetchMock.mock.calls.find(
            ([url, init]) =>
                String(url).endsWith("/git/commits") && init?.method === "POST",
        );
        const commitBody = JSON.parse(String(commitCall?.[1]?.body));
        expect(commitBody.parents).toEqual(["commit-1"]);
        expect(commitBody.tree).toBe("tree-2");

        const refCall = fetchMock.mock.calls.find(
            ([url, init]) =>
                String(url).endsWith("/git/refs/heads/main") &&
                init?.method === "PATCH",
        );
        const refBody = JSON.parse(String(refCall?.[1]?.body));
        expect(refBody.sha).toBe("commit-2");
    });
});
