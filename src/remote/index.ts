/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Connection } from "@/types";
import { RemoteError } from "@/remote/errors";
import type { RemoteAdapter } from "@/remote/adapter";
import { createGitContentsAdapter } from "@/remote/git-contents";
import { createWebDavAdapter } from "@/remote/webdav";

export function providerLabel(connection: Pick<Connection, "provider">): string {
    switch (connection.provider) {
        case "github":
            return "GitHub";
        case "gitee":
            return "Gitee";
        case "webdav":
            return "WebDAV";
    }
}

export function createRemoteAdapter(connection: Connection): RemoteAdapter {
    if (connection.provider === "github" || connection.provider === "gitee") {
        if (!connection.owner?.trim() || !connection.repo?.trim()) {
            throw new RemoteError("请填写仓库 owner 和 repo");
        }
        if (!connection.token?.trim()) {
            throw new RemoteError("请填写访问 token，或先完成 OAuth 登录");
        }
        return createGitContentsAdapter({
            provider: connection.provider,
            owner: connection.owner.trim(),
            repo: connection.repo.trim(),
            branch: connection.branch?.trim() || undefined,
            token: connection.token.trim(),
        });
    }

    if (!connection.url?.trim()) {
        throw new RemoteError("请填写 WebDAV 地址");
    }
    return createWebDavAdapter({
        url: connection.url.trim(),
        username: connection.username ?? "",
        password: connection.password ?? "",
    });
}
