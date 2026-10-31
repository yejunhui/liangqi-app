/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Resolves the person behind a remote token, so entries can carry a stable
 * author id without trusting user-entered names.
 */

import type { Connection, RemoteUser } from "@/types";
import { useLocalUserStore } from "@/store/identity";

const COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#0369a1", "#b45309", "#be123c"];

function colorFor(id: string): string {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
        hash = (hash * 31 + id.charCodeAt(index)) | 0;
    }
    return COLORS[Math.abs(hash) % COLORS.length];
}

function localFallback(connection: Connection): RemoteUser {
    const local = useLocalUserStore.getState().user;
    return {
        id: local.id,
        name: local.name,
        color: local.color,
        provider: connection.provider,
    };
}

async function tokenFallback(connection: Connection): Promise<RemoteUser> {
    if (!connection.token || !globalThis.crypto?.subtle) {
        return localFallback(connection);
    }
    try {
        const data = new TextEncoder().encode(
            `${connection.provider}:${connection.token}`,
        );
        const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
        const hex = Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
        const id = `${connection.provider}:key:${hex.slice(0, 16)}`;
        return {
            id,
            name: `用户 ${hex.slice(0, 4).toUpperCase()}`,
            color: colorFor(id),
            provider: connection.provider,
        };
    } catch {
        return localFallback(connection);
    }
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 8_000);
    try {
        const response = await fetch(url, {
            headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    } finally {
        globalThis.clearTimeout(timer);
    }
}

export async function resolveConnectionUser(
    connection: Connection,
): Promise<RemoteUser> {
    if (connection.provider === "webdav") {
        const name = connection.username?.trim();
        if (name) {
            return {
                id: `webdav:${name}`,
                name,
                color: colorFor(name),
                provider: "webdav",
            };
        }
        return localFallback(connection);
    }

    if (!connection.token) {
        return localFallback(connection);
    }

    if (connection.provider === "github") {
        const payload = await fetchJson("https://api.github.com/user", {
            Authorization: `Bearer ${connection.token}`,
            Accept: "application/vnd.github+json",
        });
        if (typeof payload === "object" && payload !== null) {
            const record = payload as {
                id?: unknown;
                login?: unknown;
                name?: unknown;
            };
            const login = typeof record.login === "string" ? record.login : "";
            const id =
                typeof record.id === "number"
                    ? `github:${record.id}`
                    : login
                      ? `github:${login}`
                      : "";
            if (id) {
                return {
                    id,
                    name:
                        (typeof record.name === "string" && record.name.trim()) ||
                        login ||
                        "GitHub 用户",
                    color: colorFor(id),
                    provider: "github",
                };
            }
        }
    }

    if (connection.provider === "gitee") {
        const payload = await fetchJson(
            `https://gitee.com/api/v5/user?access_token=${encodeURIComponent(
                connection.token,
            )}`,
        );
        if (typeof payload === "object" && payload !== null) {
            const record = payload as {
                id?: unknown;
                login?: unknown;
                name?: unknown;
            };
            const login = typeof record.login === "string" ? record.login : "";
            const id =
                typeof record.id === "number"
                    ? `gitee:${record.id}`
                    : login
                      ? `gitee:${login}`
                      : "";
            if (id) {
                return {
                    id,
                    name:
                        (typeof record.name === "string" && record.name.trim()) ||
                        login ||
                        "Gitee 用户",
                    color: colorFor(id),
                    provider: "gitee",
                };
            }
        }
    }

    return tokenFallback(connection);
}
