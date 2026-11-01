/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Liangqi OAuth broker for GitHub and Gitee.
 *
 * Deploy this as a separate service (Cloudflare Worker or any Fetch API host).
 * It only exchanges OAuth codes for tokens; ledger data never passes through it.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

function html(body, status = 200) {
    return new Response(body, {
        status,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy":
                "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        },
    });
}

function base64UrlEncode(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
    const padded =
        value.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function base64UrlEncodeString(value) {
    return base64UrlEncode(encoder.encode(value));
}

function base64UrlDecodeString(value) {
    return decoder.decode(base64UrlDecode(value));
}

async function hmacKey(secret) {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

async function signState(payload, secret) {
    const body = base64UrlEncodeString(JSON.stringify(payload));
    const signature = await crypto.subtle.sign(
        "HMAC",
        await hmacKey(secret),
        encoder.encode(body),
    );
    return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifyState(value, secret) {
    const [body, signature] = value.split(".");
    if (!body || !signature) {
        return null;
    }
    const valid = await crypto.subtle.verify(
        "HMAC",
        await hmacKey(secret),
        base64UrlDecode(signature),
        encoder.encode(body),
    );
    if (!valid) {
        return null;
    }
    try {
        const payload = JSON.parse(base64UrlDecodeString(body));
        if (
            !payload ||
            typeof payload.ts !== "number" ||
            typeof payload.origin !== "string" ||
            typeof payload.provider !== "string" ||
            Date.now() - payload.ts > 10 * 60 * 1000
        ) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function allowedOrigins(env) {
    return (env.APP_ORIGINS || env.APP_ORIGIN || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function resolveOrigin(request, env) {
    const origins = allowedOrigins(env);
    if (origins.length === 0) {
        throw new Error("APP_ORIGINS is not configured");
    }
    const requested = new URL(request.url).searchParams.get("origin");
    if (requested && origins.includes(requested)) {
        return requested;
    }
    if (origins.length === 1) {
        return origins[0];
    }
    throw new Error("origin is not allowed");
}

function providerConfig(env, provider) {
    if (provider === "github") {
        return {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            authorizeUrl: "https://github.com/login/oauth/authorize",
            scope: "repo",
            tokenUrl: "https://github.com/login/oauth/access_token",
        };
    }
    if (provider === "gitee") {
        return {
            clientId: env.GITEE_CLIENT_ID,
            clientSecret: env.GITEE_CLIENT_SECRET,
            authorizeUrl: "https://gitee.com/oauth/authorize",
            scope: "projects",
            tokenUrl: "https://gitee.com/oauth/token",
        };
    }
    return null;
}

function callbackUrl(request, provider) {
    return new URL(`/auth/${provider}/callback`, request.url).toString();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function exchangeGithub(config, code, redirectUri) {
    const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: redirectUri,
        }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data.access_token !== "string") {
        throw new Error(data?.error_description || data?.error || "GitHub token exchange failed");
    }
    return data.access_token;
}

async function exchangeGitee(config, code, redirectUri) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
    });
    const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data.access_token !== "string") {
        throw new Error(data?.error_description || data?.error || "Gitee token exchange failed");
    }
    return data.access_token;
}

async function handleStart(request, env, provider) {
    const config = providerConfig(env, provider);
    if (!config) {
        return html("<h1>Unknown provider</h1>", 404);
    }
    if (!config.clientId || !config.clientSecret) {
        return html(`<h1>${provider} OAuth is not configured</h1>`, 500);
    }
    if (!env.STATE_SECRET) {
        return html("<h1>STATE_SECRET is not configured</h1>", 500);
    }

    let origin;
    try {
        origin = resolveOrigin(request, env);
    } catch (error) {
        return html(`<h1>${escapeHtml(error.message)}</h1>`, 400);
    }

    const state = await signState(
        {
            provider,
            origin,
            ts: Date.now(),
            nonce: crypto.randomUUID(),
        },
        env.STATE_SECRET,
    );
    const redirectUri = callbackUrl(request, provider);
    const authorize = new URL(config.authorizeUrl);
    authorize.searchParams.set("client_id", config.clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("state", state);
    if (provider === "github") {
        authorize.searchParams.set("scope", config.scope);
    } else {
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("scope", config.scope);
    }
    return Response.redirect(authorize.toString(), 302);
}

async function handleCallback(request, env, provider) {
    const config = providerConfig(env, provider);
    if (!config) {
        return html("<h1>Unknown provider</h1>", 404);
    }
    if (!env.STATE_SECRET) {
        return html("<h1>STATE_SECRET is not configured</h1>", 500);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
        return html("<h1>Missing OAuth code or state</h1>", 400);
    }

    const payload = await verifyState(state, env.STATE_SECRET);
    if (!payload || payload.provider !== provider) {
        return html("<h1>Invalid or expired OAuth state</h1>", 400);
    }

    const origins = allowedOrigins(env);
    if (!origins.includes(payload.origin)) {
        return html("<h1>Origin is not allowed</h1>", 400);
    }

    let token;
    try {
        token =
            provider === "github"
                ? await exchangeGithub(config, code, callbackUrl(request, provider))
                : await exchangeGitee(config, code, callbackUrl(request, provider));
    } catch (error) {
        return html(
            `<h1>OAuth failed</h1><p>${escapeHtml(error.message || "Unknown error")}</p>`,
            502,
        );
    }

    const message = JSON.stringify({
        type: "liangqi-oauth",
        provider,
        token,
    }).replace(/</g, "\\u003c");
    const origin = JSON.stringify(payload.origin);

    return html(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>登录完成</title></head>
<body style="font-family:system-ui;padding:2rem;color:#1c1917">
<p>登录完成，正在返回两讫…</p>
<script>
const payload = ${message};
if (window.opener) {
  window.opener.postMessage(payload, ${origin});
  window.close();
} else {
  document.body.innerHTML = "<p>登录完成，请返回两讫。</p>";
}
</script>
</body>
</html>`);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/health") {
            return json({ ok: true });
        }

        const start = /^\/auth\/(github|gitee)$/.exec(url.pathname);
        if (start) {
            return handleStart(request, env, start[1]);
        }

        const callback = /^\/auth\/(github|gitee)\/callback$/.exec(url.pathname);
        if (callback) {
            return handleCallback(request, env, callback[1]);
        }

        return json({ error: "Not found" }, 404);
    },
};
