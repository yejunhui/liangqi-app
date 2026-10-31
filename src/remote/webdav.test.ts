/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebDavAdapter } from "@/remote/webdav";
import { RemoteConflictError } from "@/remote/errors";

const fetchMock = vi.fn<typeof fetch>();

function response(status: number, body = "", etag?: string): Response {
    return new Response(body, {
        status,
        headers: etag ? { ETag: etag } : undefined,
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

const adapter = createWebDavAdapter({
    url: "https://dav.example.com/ledger/",
    username: "user",
    password: "pass",
});

describe("WebDAV adapter", () => {
    it("tests the base collection with PROPFIND", async () => {
        fetchMock.mockResolvedValueOnce(response(207));
        await expect(adapter.test()).resolves.toEqual({});
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://dav.example.com/ledger/");
        expect(init?.method).toBe("PROPFIND");
        expect(
            ((init?.headers ?? {}) as Record<string, string>).Authorization,
        ).toMatch(/^Basic /);
    });

    it("reads a file and returns its ETag revision", async () => {
        fetchMock.mockResolvedValueOnce(response(200, "{\"ok\":true}", "\"etag-1\""));
        await expect(adapter.readFile("liangqi/index.json")).resolves.toEqual({
            text: "{\"ok\":true}",
            revision: "\"etag-1\"",
        });
        expect(String(fetchMock.mock.calls[0][0])).toBe(
            "https://dav.example.com/ledger/liangqi/index.json",
        );
    });

    it("creates parent collections before writing", async () => {
        fetchMock
            .mockResolvedValueOnce(response(201))
            .mockResolvedValueOnce(response(405))
            .mockResolvedValueOnce(response(201, "", "\"etag-2\""));

        const result = await adapter.writeFile(
            "liangqi/books/book_1.json",
            "{}",
        );
        expect(result.revision).toBe("\"etag-2\"");

        expect(fetchMock.mock.calls[0][1]?.method).toBe("MKCOL");
        expect(String(fetchMock.mock.calls[0][0])).toContain("/liangqi");
        expect(fetchMock.mock.calls[1][1]?.method).toBe("MKCOL");
        expect(String(fetchMock.mock.calls[1][0])).toContain("/liangqi/books");
        const put = fetchMock.mock.calls[2];
        expect(put[1]?.method).toBe("PUT");
        expect(
            ((put[1]?.headers ?? {}) as Record<string, string>)["If-None-Match"],
        ).toBe("*");
    });

    it("raises a conflict on 412", async () => {
        fetchMock
            .mockResolvedValueOnce(response(405))
            .mockResolvedValueOnce(response(412));

        await expect(
            adapter.writeFile("liangqi/index.json", "{}", "\"old\""),
        ).rejects.toBeInstanceOf(RemoteConflictError);
        const put = fetchMock.mock.calls[1];
        expect(
            ((put[1]?.headers ?? {}) as Record<string, string>)["If-Match"],
        ).toBe("\"old\"");
    });
});
