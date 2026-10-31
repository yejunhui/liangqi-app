/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RemoteProvider } from "@/types";
import { decodeBase64Utf8, encodeBase64Utf8 } from "@/remote/base64";
import { RemoteConflictError, RemoteError } from "@/remote/errors";
import type { RemoteAdapter, RemoteFile, RemoteTestResult } from "@/remote/adapter";

interface GitContentsConfig {
    provider: Extract<RemoteProvider, "github" | "gitee">;
    owner: string;
    repo: string;
    branch?: string;
    token: string;
}

function encodePath(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function apiBase(provider: GitContentsConfig["provider"]): string {
    return provider === "github"
        ? "https://api.github.com"
        : "https://gitee.com/api/v5";
}

function providerLabel(provider: GitContentsConfig["provider"]): string {
    return provider === "github" ? "GitHub" : "Gitee";
}

function errorMessage(data: unknown, fallback: string): string {
    if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        if (typeof record.message === "string") {
            return record.message;
        }
        if (typeof record.error === "string") {
            return record.error;
        }
    }
    return fallback;
}

export function createGitContentsAdapter(config: GitContentsConfig): RemoteAdapter {
    const base = apiBase(config.provider);
    const label = providerLabel(config.provider);

    function repoUrl(): string {
        const url = new URL(
            `${base}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`,
        );
        if (config.provider === "gitee") {
            url.searchParams.set("access_token", config.token);
        }
        return url.toString();
    }

    function contentsUrl(path: string, ref?: string): string {
        const url = new URL(
            `${base}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
                config.repo,
            )}/contents/${encodePath(path)}`,
        );
        if (config.provider === "gitee") {
            url.searchParams.set("access_token", config.token);
        }
        if (ref) {
            url.searchParams.set("ref", ref);
        }
        return url.toString();
    }

    function headers(): Record<string, string> {
        const result: Record<string, string> = {
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
        };
        if (config.provider === "github") {
            result.Authorization = `Bearer ${config.token}`;
        }
        return result;
    }

    async function request(url: string, init?: RequestInit): Promise<Response> {
        try {
            return await fetch(url, { ...init, headers: { ...headers(), ...init?.headers } });
        } catch {
            throw new RemoteError(
                `无法连接 ${label}。请检查网络，或确认该服务允许浏览器跨域访问。`,
            );
        }
    }

    return {
        provider: config.provider,

        async test(): Promise<RemoteTestResult> {
            const response = await request(repoUrl());
            if (response.status === 404) {
                throw new RemoteError("仓库不存在，或 token 没有访问权限", 404);
            }
            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null);
                throw new RemoteError(
                    errorMessage(data, `${label} 认证失败`),
                    response.status,
                );
            }
            const data = (await response.json()) as Record<string, unknown>;
            return {
                defaultBranch:
                    typeof data.default_branch === "string"
                        ? data.default_branch
                        : undefined,
            };
        },

        async readFile(path: string): Promise<RemoteFile | null> {
            const response = await request(contentsUrl(path, config.branch));
            if (response.status === 404) {
                return null;
            }
            if (response.status === 401 || response.status === 403) {
                throw new RemoteError(
                    `${label} 认证失败，或 token 没有仓库读写权限`,
                    response.status,
                );
            }
            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null);
                throw new RemoteError(
                    errorMessage(data, `读取 ${path} 失败`),
                    response.status,
                );
            }
            const data = (await response.json()) as Record<string, unknown>;
            if (
                typeof data.content !== "string" ||
                (typeof data.type === "string" && data.type !== "file")
            ) {
                throw new RemoteError(`${path} 不是可读取的文件`);
            }
            if (data.encoding !== "base64") {
                throw new RemoteError(`${path} 的编码格式不受支持`);
            }
            return {
                text: decodeBase64Utf8(data.content),
                revision: typeof data.sha === "string" ? data.sha : undefined,
            };
        },

        async writeFile(
            path: string,
            text: string,
            revision?: string,
        ): Promise<{ revision?: string }> {
            const url = contentsUrl(path);
            const body: Record<string, unknown> = {
                message: `liangqi: update ${path}`,
                content: encodeBase64Utf8(text),
            };
            if (config.branch) {
                body.branch = config.branch;
            }
            if (revision) {
                body.sha = revision;
            }
            if (config.provider === "gitee") {
                body.access_token = config.token;
            }

            const response = await request(url, {
                method: "PUT",
                body: JSON.stringify(body),
            });

            if (response.status === 409) {
                throw new RemoteConflictError();
            }
            if (response.status === 401 || response.status === 403) {
                throw new RemoteError(
                    `${label} 认证失败，或 token 没有仓库读写权限`,
                    response.status,
                );
            }
            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null);
                const message = errorMessage(data, `写入 ${path} 失败`);
                if (response.status === 422 && /sha|conflict|does not match/i.test(message)) {
                    throw new RemoteConflictError(message);
                }
                throw new RemoteError(message, response.status);
            }

            const data = (await response.json()) as Record<string, unknown>;
            const content = data.content as Record<string, unknown> | undefined;
            return {
                revision:
                    typeof content?.sha === "string"
                        ? content.sha
                        : typeof data.sha === "string"
                          ? data.sha
                          : undefined,
            };
        },

        async ensureDirectory() {
            // Git contents APIs create parent paths automatically.
        },
    };
}
