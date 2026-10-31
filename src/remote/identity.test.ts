/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Connection } from "@/types";
import { resolveConnectionUser } from "@/remote/identity";

const base: Connection = {
    id: "conn_1",
    provider: "github",
    label: "GitHub · me/ledger",
    createdAt: Date.now(),
    owner: "me",
    repo: "ledger",
    token: "token-123",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("remote identity", () => {
    it("resolves a GitHub account from the token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(
                    JSON.stringify({ id: 42, login: "alice", name: "Alice" }),
                    { status: 200 },
                ),
            ),
        );
        await expect(resolveConnectionUser(base)).resolves.toMatchObject({
            id: "github:42",
            name: "Alice",
            provider: "github",
        });
    });

    it("uses a stable token fallback when the API is unavailable", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("nope", { status: 401 })),
        );
        const first = await resolveConnectionUser(base);
        const second = await resolveConnectionUser({ ...base });
        expect(first.id).toMatch(/^github:key:/);
        expect(second.id).toBe(first.id);
    });

    it("uses the WebDAV username as identity", async () => {
        await expect(
            resolveConnectionUser({
                ...base,
                provider: "webdav",
                url: "https://dav.example.com/ledger/",
                username: "bob",
                password: "secret",
                token: undefined,
            }),
        ).resolves.toMatchObject({
            id: "webdav:bob",
            name: "bob",
            provider: "webdav",
        });
    });
});
