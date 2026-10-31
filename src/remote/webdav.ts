/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { encodeBasicAuth } from "@/remote/base64";
import { RemoteConflictError, RemoteError } from "@/remote/errors";
import type { RemoteAdapter, RemoteFile, RemoteTestResult } from "@/remote/adapter";

interface WebDavConfig {
    url: string;
    username: string;
    password: string;
}

function normalizeBaseUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new RemoteError("WebDAV 地址不能为空");
    }
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function encodePath(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

export function createWebDavAdapter(config: WebDavConfig): RemoteAdapter {
    const baseUrl = normalizeBaseUrl(config.url);
    const authorization = encodeBasicAuth(config.username, config.password);

    function urlFor(path: string): string {
        return `${baseUrl}${encodePath(path)}`;
    }

    function headers(extra?: HeadersInit): HeadersInit {
        return {
            Authorization: authorization,
            ...extra,
        };
    }

    async function request(path: string, init?: RequestInit): Promise<Response> {
        try {
            return await fetch(urlFor(path), {
                ...init,
                headers: headers(init?.headers),
            });
        } catch {
            throw new RemoteError(
                "无法连接 WebDAV。请检查地址、账号密码，以及服务器是否允许浏览器跨域访问。",
            );
        }
    }

    return {
        provider: "webdav",

        async test(): Promise<RemoteTestResult> {
            const response = await request("", {
                method: "PROPFIND",
                headers: {
                    Depth: "0",
                },
            });
            if (response.status === 401 || response.status === 403) {
                throw new RemoteError("WebDAV 认证失败，请检查账号和密码", response.status);
            }
            if (response.status === 404) {
                throw new RemoteError("WebDAV 地址不存在，请检查路径", 404);
            }
            if (!response.ok && response.status !== 207) {
                throw new RemoteError(
                    `WebDAV 连接失败（HTTP ${response.status}）`,
                    response.status,
                );
            }
            return {};
        },

        async readFile(path: string): Promise<RemoteFile | null> {
            const response = await request(path);
            if (response.status === 404) {
                return null;
            }
            if (response.status === 401 || response.status === 403) {
                throw new RemoteError("WebDAV 认证失败，请检查账号和密码", response.status);
            }
            if (!response.ok) {
                throw new RemoteError(
                    `读取 ${path} 失败（HTTP ${response.status}）`,
                    response.status,
                );
            }
            return {
                text: await response.text(),
                revision: response.headers.get("etag") ?? undefined,
            };
        },

        async writeFile(
            path: string,
            text: string,
            revision?: string,
        ): Promise<{ revision?: string }> {
            const parent = path.split("/").slice(0, -1).join("/");
            if (parent) {
                await this.ensureDirectory(parent);
            }

            const extra: Record<string, string> = {
                "Content-Type": "application/json; charset=utf-8",
            };
            if (revision) {
                extra["If-Match"] = revision;
            } else {
                extra["If-None-Match"] = "*";
            }

            const response = await request(path, {
                method: "PUT",
                headers: extra,
                body: text,
            });

            if (response.status === 412) {
                throw new RemoteConflictError();
            }
            if (response.status === 401 || response.status === 403) {
                throw new RemoteError("WebDAV 认证失败，请检查账号和密码", response.status);
            }
            if (!response.ok) {
                throw new RemoteError(
                    `写入 ${path} 失败（HTTP ${response.status}）`,
                    response.status,
                );
            }

            let nextRevision = response.headers.get("etag") ?? undefined;
            if (!nextRevision) {
                nextRevision = (await this.readFile(path))?.revision;
            }
            return { revision: nextRevision };
        },

        async ensureDirectory(path: string): Promise<void> {
            const segments = path.split("/").filter(Boolean);
            let current = "";
            for (const segment of segments) {
                current = current ? `${current}/${segment}` : segment;
                const response = await request(current, { method: "MKCOL" });
                if (
                    response.ok ||
                    response.status === 301 ||
                    response.status === 405 ||
                    response.status === 409
                ) {
                    continue;
                }
                if (response.status === 401 || response.status === 403) {
                    throw new RemoteError(
                        "WebDAV 认证失败，请检查账号和密码",
                        response.status,
                    );
                }
                throw new RemoteError(
                    `创建目录 ${current} 失败（HTTP ${response.status}）`,
                    response.status,
                );
            }
        },
    };
}
