/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RemoteProvider } from "@/types";
import { decodeBase64Utf8, encodeBase64Utf8 } from "@/remote/base64";
import { RemoteConflictError, RemoteError } from "@/remote/errors";
import type { RemoteAdapter, RemoteFile, RemoteTestResult } from "@/remote/adapter";

import { t } from "@/i18n";

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
            Accept:
                config.provider === "github"
                    ? "application/vnd.github+json"
                    : "application/json",
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
                t("无法连接 {0}。请检查网络，或确认该服务允许浏览器跨域访问。", [label]),
            );
        }
    }

    let resolvedBranch: string | undefined = config.branch;

    async function resolveBranch(): Promise<string> {
        if (resolvedBranch) {
            return resolvedBranch;
        }
        const response = await request(repoUrl());
        if (!response.ok) {
            throw new RemoteError(t("读取 {0} 默认分支失败", [label]), response.status);
        }
        const data = (await response.json()) as Record<string, unknown>;
        if (typeof data.default_branch !== "string") {
            throw new RemoteError(t("{0} 没有返回默认分支", [label]));
        }
        resolvedBranch = data.default_branch;
        return resolvedBranch;
    }

    function gitUrl(path: string): string {
        return `${base}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
            config.repo,
        )}/git/${path}`;
    }

    function refPath(branch: string): string {
        return branch
            .split("/")
            .map((segment) => encodeURIComponent(segment))
            .join("/");
    }

    async function writeFilesGitHub(
        files: Array<{ path: string; text: string | null }>,
        message: string,
    ): Promise<void> {
        if (files.length === 0) {
            return;
        }
        const branch = await resolveBranch();
        const branchRef = refPath(branch);

        const refResponse = await request(gitUrl(`ref/heads/${branchRef}`));
        if (refResponse.status === 404) {
            throw new RemoteError(t("{0} 分支 {1} 不存在", [label, branch]), 404);
        }
        if (!refResponse.ok) {
            throw new RemoteError(t("读取 {0} 分支失败", [label]), refResponse.status);
        }
        const refData = (await refResponse.json()) as Record<string, unknown>;
        const refObject = refData.object as Record<string, unknown> | undefined;
        const commitSha =
            typeof refObject?.sha === "string" ? refObject.sha : undefined;
        if (!commitSha) {
            throw new RemoteError(t("无法读取远程 commit"));
        }

        const commitResponse = await request(gitUrl(`commits/${commitSha}`));
        if (!commitResponse.ok) {
            throw new RemoteError(t("读取远程 commit 失败"), commitResponse.status);
        }
        const commitData = (await commitResponse.json()) as Record<string, unknown>;
        const tree = commitData.tree as Record<string, unknown> | undefined;
        const baseTreeSha = typeof tree?.sha === "string" ? tree.sha : undefined;
        if (!baseTreeSha) {
            throw new RemoteError(t("无法读取远程 tree"));
        }

        const treeEntries = await Promise.all(
            files.map(async (file) => {
                if (file.text === null) {
                    return {
                        path: file.path,
                        mode: "100644",
                        type: "blob",
                        sha: null,
                    };
                }
                const blobResponse = await request(gitUrl("blobs"), {
                    method: "POST",
                    body: JSON.stringify({
                        content: encodeBase64Utf8(file.text),
                        encoding: "base64",
                    }),
                });
                if (!blobResponse.ok) {
                    throw new RemoteError(t("创建远程 blob 失败"), blobResponse.status);
                }
                const blob = (await blobResponse.json()) as Record<string, unknown>;
                if (typeof blob.sha !== "string") {
                    throw new RemoteError(t("远程 blob 没有返回 sha"));
                }
                return {
                    path: file.path,
                    mode: "100644",
                    type: "blob",
                    sha: blob.sha,
                };
            }),
        );

        const treeResponse = await request(gitUrl("trees"), {
            method: "POST",
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries,
            }),
        });
        if (!treeResponse.ok) {
            throw new RemoteError(t("创建远程 tree 失败"), treeResponse.status);
        }
        const newTree = (await treeResponse.json()) as Record<string, unknown>;
        if (typeof newTree.sha !== "string") {
            throw new RemoteError(t("远程 tree 没有返回 sha"));
        }

        const newCommitResponse = await request(gitUrl("commits"), {
            method: "POST",
            body: JSON.stringify({
                message,
                tree: newTree.sha,
                parents: [commitSha],
            }),
        });
        if (!newCommitResponse.ok) {
            throw new RemoteError(t("创建远程 commit 失败"), newCommitResponse.status);
        }
        const newCommit = (await newCommitResponse.json()) as Record<string, unknown>;
        if (typeof newCommit.sha !== "string") {
            throw new RemoteError(t("远程 commit 没有返回 sha"));
        }

        const updateResponse = await request(
            gitUrl(`refs/heads/${branchRef}`),
            {
                method: "PATCH",
                body: JSON.stringify({
                    sha: newCommit.sha,
                    force: false,
                }),
            },
        );
        if (updateResponse.status === 409 || updateResponse.status === 422) {
            throw new RemoteConflictError();
        }
        if (!updateResponse.ok) {
            throw new RemoteError(t("更新远程分支失败"), updateResponse.status);
        }
    }

    async function readFileRevision(path: string): Promise<string | undefined> {
        const response = await request(contentsUrl(path, config.branch));
        if (response.status === 404) {
            return undefined;
        }
        if (response.status === 401 || response.status === 403) {
            throw new RemoteError(
                t("{0} 认证失败，或 token 没有仓库读写权限", [label]),
                response.status,
            );
        }
        if (!response.ok) {
            const data: unknown = await response.json().catch(() => null);
            throw new RemoteError(
                errorMessage(data, t("读取 {0} 失败（HTTP {1}）", [path, response.status])),
                response.status,
            );
        }
        const data = (await response.json()) as unknown;
        if (Array.isArray(data)) {
            if (data.length === 0) {
                return undefined;
            }
            throw new RemoteError(t("{0} 是目录，不是文件", [path]));
        }
        if (typeof data !== "object" || data === null) {
            return undefined;
        }
        const sha = (data as Record<string, unknown>).sha;
        return typeof sha === "string" ? sha : undefined;
    }

    return {
        provider: config.provider,

        async test(): Promise<RemoteTestResult> {
            const response = await request(repoUrl());
            if (response.status === 404) {
                throw new RemoteError(t("仓库不存在，或 token 没有访问权限"), 404);
            }
            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null);
                throw new RemoteError(
                    errorMessage(data, t("{0} 认证失败", [label])),
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
                    t("{0} 认证失败，或 token 没有仓库读写权限", [label]),
                    response.status,
                );
            }
            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null);
                throw new RemoteError(
                    errorMessage(data, t("读取 {0} 失败", [path])),
                    response.status,
                );
            }
            const data = (await response.json()) as Record<string, unknown>;
            if (Array.isArray(data)) {
                // Gitee returns 200 with [] for a missing path instead of 404.
                if (data.length === 0) {
                    return null;
                }
                throw new RemoteError(t("{0} 是目录，不是文件", [path]));
            }
            if (
                typeof data.content !== "string" ||
                (typeof data.type === "string" && data.type !== "file")
            ) {
                throw new RemoteError(t("{0} 不是可读取的文件", [path]));
            }
            if (data.encoding !== "base64") {
                throw new RemoteError(t("{0} 的编码格式不受支持", [path]));
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

            // GitHub always uses PUT. Gitee uses POST for a new file and PUT
            // with the current sha when updating an existing file.
            let method: "POST" | "PUT" = "PUT";
            let currentRevision = revision;
            if (config.provider === "gitee" && !currentRevision) {
                currentRevision = await readFileRevision(path);
                if (!currentRevision) {
                    method = "POST";
                }
            }

            const body: Record<string, unknown> = {
                message: `liangqi: update ${path}`,
                content: encodeBase64Utf8(text),
            };
            if (config.branch) {
                body.branch = config.branch;
            }
            if (currentRevision) {
                body.sha = currentRevision;
            }
            if (config.provider === "gitee") {
                body.access_token = config.token;
            }

            let response = await request(url, {
                method,
                body: JSON.stringify(body),
            });

            // The file may have been created after the existence check.
            if (
                config.provider === "gitee" &&
                !revision &&
                !currentRevision &&
                (response.status === 400 ||
                    response.status === 404 ||
                    response.status === 409)
            ) {
                const latest = await readFileRevision(path);
                if (latest) {
                    body.sha = latest;
                    response = await request(url, {
                        method: "PUT",
                        body: JSON.stringify(body),
                    });
                }
            }

            if (response.status === 409) {
                throw new RemoteConflictError();
            }
            if (response.status === 401 || response.status === 403) {
                throw new RemoteError(
                    t("{0} 认证失败，或 token 没有仓库读写权限", [label]),
                    response.status,
                );
            }
            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null);
                const message = errorMessage(
                    data,
                    t("写入 {0} 失败（HTTP {1}）", [path, response.status]),
                );
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

        ...(config.provider === "github" ? { writeFiles: writeFilesGitHub } : {}),
    };
}
