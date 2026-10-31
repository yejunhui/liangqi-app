/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RemoteProvider } from "@/types";

export interface RepositoryInput {
    owner?: string;
    repo: string;
}

/** Accepts "repo", "owner/repo", a GitHub/Gitee URL, or a URL ending in .git. */
export function parseRepositoryInput(value: string): RepositoryInput {
    const text = value.trim();
    if (!text) {
        return { repo: "" };
    }
    if (/^https?:\/\//i.test(text)) {
        try {
            const url = new URL(text);
            const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
            if (parts.length >= 2) {
                return {
                    owner: parts[0],
                    repo: parts[1].replace(/\.git$/i, ""),
                };
            }
            return { repo: parts[0]?.replace(/\.git$/i, "") ?? "" };
        } catch {
            return { repo: text };
        }
    }
    const parts = text.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length >= 2) {
        return {
            owner: parts[0],
            repo: parts[1].replace(/\.git$/i, ""),
        };
    }
    return { repo: parts[0]?.replace(/\.git$/i, "") ?? "" };
}

async function fetchJson(url: string, headers?: Record<string, string>) {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 8_000);
    try {
        const response = await fetch(url, { headers, signal: controller.signal });
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

/** Resolves the account login behind a token, used to fill a missing owner. */
export async function resolveProviderLogin(
    provider: RemoteProvider,
    token: string,
): Promise<string | undefined> {
    if (!token) {
        return undefined;
    }
    if (provider === "github") {
        const data = await fetchJson("https://api.github.com/user", {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
        });
        if (typeof data === "object" && data !== null) {
            const login = (data as { login?: unknown }).login;
            return typeof login === "string" ? login : undefined;
        }
        return undefined;
    }
    if (provider === "gitee") {
        const data = await fetchJson(
            `https://gitee.com/api/v5/user?access_token=${encodeURIComponent(token)}`,
        );
        if (typeof data === "object" && data !== null) {
            const login = (data as { login?: unknown }).login;
            return typeof login === "string" ? login : undefined;
        }
    }
    return undefined;
}
