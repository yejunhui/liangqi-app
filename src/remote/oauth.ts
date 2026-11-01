/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RemoteProvider } from "@/types";

import { t } from "@/i18n";

export type OAuthProvider = Extract<RemoteProvider, "github" | "gitee">;

interface OAuthMessage {
    type: "liangqi-oauth";
    provider: OAuthProvider;
    token: string;
}

export function startOAuth(
    provider: OAuthProvider,
    authBase: string,
): Promise<string> {
    const base = authBase.trim().replace(/\/+$/, "");
    if (!base) {
        throw new Error(t("请先填写 OAuth 服务地址"));
    }

    const url = `${base}/auth/${provider}?origin=${encodeURIComponent(
        window.location.origin,
    )}`;
    const popup = window.open(
        url,
        "liangqi-oauth",
        "popup=yes,width=640,height=780",
    );
    if (!popup) {
        throw new Error(t("浏览器拦截了登录窗口，请允许弹出窗口后重试"));
    }

    return new Promise<string>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(closeTimer);
            window.clearTimeout(timeoutTimer);
            if (!popup.closed) {
                popup.close();
            }
        };

        const finish = (token: string) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve(token);
        };

        const fail = (message: string) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(new Error(message));
        };

        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            const data = event.data as Partial<OAuthMessage> | undefined;
            if (
                data?.type !== "liangqi-oauth" ||
                data.provider !== provider ||
                typeof data.token !== "string" ||
                data.token.length === 0
            ) {
                return;
            }
            finish(data.token);
        };

        window.addEventListener("message", onMessage);
        const closeTimer = window.setInterval(() => {
            if (popup.closed) {
                fail(t("登录窗口已关闭"));
            }
        }, 500);
        const timeoutTimer = window.setTimeout(() => {
            fail(t("登录超时，请重试"));
        }, 5 * 60 * 1000);
    });
}
