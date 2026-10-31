/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGitContentsAdapter } from "@/remote/git-contents";
import { RemoteConflictError } from "@/remote/errors";
import { decodeBase64Utf8, encodeBase64Utf8 } from "@/remote/base64";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

describe("GitHub contents adapter", () => {
    const adapter = createGitContentsAdapter({
        provider: "github",
        owner: "me",
        repo: "ledger",
        branch: "main",
        token: "tok",
    });

    it("tests the repository and returns the default branch", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ default_branch: "main" }));
        await expect(adapter.test()).resolves.toEqual({ defaultBranch: "main" });

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://api.github.com/repos/me/ledger");
        expect(
            ((init?.headers ?? {}) as Record<string, string>).Authorization,
        ).toBe("Bearer tok");
    });

    it("reads and decodes a remote JSON file", async () => {
        const text = JSON.stringify({ app: "liangqi", version: 1 });
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                type: "file",
                encoding: "base64",
                content: encodeBase64Utf8(text),
                sha: "sha-1",
            }),
        );

        const file = await adapter.readFile("liangqi/index.json");
        expect(file).toEqual({ text, revision: "sha-1" });
        expect(String(fetchMock.mock.calls[0][0])).toContain(
            "/repos/me/ledger/contents/liangqi/index.json",
        );
    });

    it("writes a file with its revision and branch", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ content: { sha: "sha-2" } }),
        );

        const result = await adapter.writeFile(
            "liangqi/books/book_1.json",
            "hello",
            "sha-1",
        );
        expect(result.revision).toBe("sha-2");

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain("/contents/liangqi/books/book_1.json");
        expect(init?.method).toBe("PUT");
        const body = JSON.parse(String(init?.body));
        expect(decodeBase64Utf8(body.content)).toBe("hello");
        expect(body.sha).toBe("sha-1");
        expect(body.branch).toBe("main");
    });

    it("raises a conflict error on 409", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "conflict" }, 409));
        await expect(
            adapter.writeFile("liangqi/index.json", "{}", "old"),
        ).rejects.toBeInstanceOf(RemoteConflictError);
    });
});

describe("Gitee contents adapter", () => {
    const adapter = createGitContentsAdapter({
        provider: "gitee",
        owner: "me",
        repo: "ledger",
        branch: "master",
        token: "gitee-token",
    });

    it("uses access_token and the gitee v5 API", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ default_branch: "master" }));
        await adapter.test();
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain("https://gitee.com/api/v5/repos/me/ledger");
        expect(url).toContain("access_token=gitee-token");
    });

    it("creates a new file with POST", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse([]))
            .mockResolvedValueOnce(
                jsonResponse({ content: { sha: "new-sha" } }, 201),
            );

        const result = await adapter.writeFile("liangqi/meta.json", "hello");
        expect(result.revision).toBe("new-sha");

        expect(fetchMock.mock.calls[0][1]?.method ?? "GET").toBe("GET");
        const [url, init] = fetchMock.mock.calls[1];
        expect(String(url)).toContain("/contents/liangqi/meta.json");
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(decodeBase64Utf8(body.content)).toBe("hello");
        expect(body.sha).toBeUndefined();
        expect(body.access_token).toBe("gitee-token");
    });

    it("treats an empty Gitee listing as a missing file", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([]));
        await expect(adapter.readFile("liangqi/manifest.json")).resolves.toBeNull();
    });

    it("updates an existing file with PUT and its sha", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ sha: "old-sha" }))
            .mockResolvedValueOnce(
                jsonResponse({ content: { sha: "next-sha" } }),
            );

        const result = await adapter.writeFile("liangqi/meta.json", "hello");
        expect(result.revision).toBe("next-sha");

        const [url, init] = fetchMock.mock.calls[1];
        expect(String(url)).toContain("/contents/liangqi/meta.json");
        expect(init?.method).toBe("PUT");
        const body = JSON.parse(String(init?.body));
        expect(body.sha).toBe("old-sha");
    });
});
