/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Account, Category } from "@/types";
import type { QuickEntrySuggestion } from "@/domain/quick-entry";
import { fromDateInputValue, toDateInputValue } from "@/utils/date";
import type { AiConfig } from "@/store/ai";
import { t } from "@/i18n";

function chatEndpoint(endpoint: string): string {
    const trimmed = endpoint.trim().replace(/\/+$/, "");
    if (trimmed.endsWith("/chat/completions")) {
        return trimmed;
    }
    return `${trimmed}/chat/completions`;
}

function extractJson(text: string): unknown {
    const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    return JSON.parse(cleaned);
}

export interface AiMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface AiChatOptions {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}

export async function requestAiChat(
    config: AiConfig,
    messages: AiMessage[],
    options: AiChatOptions = {},
): Promise<string> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? 45_000,
    );
    let response: Response;
    try {
        response = await fetch(chatEndpoint(config.endpoint), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                temperature: options.temperature ?? 0.4,
                ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
                messages,
            }),
            signal: controller.signal,
        });
    } finally {
        globalThis.clearTimeout(timer);
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? (data as { error?: { message?: string } }).error?.message
                : undefined;
        throw new Error(message ?? t("AI 请求失败（{0}）", [response.status]));
    }
    const choices =
        typeof data === "object" && data !== null
            ? (
                  data as {
                      choices?: Array<{
                          message?: {
                              content?: unknown;
                          };
                      }>;
                  }
              ).choices
            : undefined;
    const rawContent = choices?.[0]?.message?.content;
    if (typeof rawContent === "string") {
        return rawContent;
    }
    if (Array.isArray(rawContent)) {
        const text = rawContent
            .map((item) =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as { text?: unknown }).text === "string"
                    ? (item as { text: string }).text
                    : "",
            )
            .join("");
        if (text) {
            return text;
        }
    }
    throw new Error(t("AI 返回内容为空"));
}

export async function parseQuickEntryWithAi(input: {
    text: string;
    categories: Category[];
    accounts: Account[];
    config: AiConfig;
    now?: number;
}): Promise<QuickEntrySuggestion> {
    const now = input.now ?? Date.now();
    const categoryList = input.categories.map((category) => ({
        name: category.name,
        kind: category.kind,
        parent: category.parent
            ? input.categories.find((item) => item.id === category.parent)?.name
            : undefined,
    }));
    const accountList = input.accounts.map((account) => ({
        name: account.name,
        kind: account.kind,
    }));
    const system = [
        "你是记账助手。把用户的一句话解析成一条流水记录。",
        '只返回 JSON，不要解释或 Markdown。字段：{"amount": number, "kind": "expense"|"income", "paymentMode": "asset"|"liability", "categoryName": string|null, "accountName": string|null, "date": "YYYY-MM-DD", "note": string}。',
        "amount 使用元，必须大于 0。",
        "kind=expense 表示支出，kind=income 表示收入。",
        "如果 accountName 对应负债账户，paymentMode 用 liability；对应资产账户用 asset；只有账户不确定时才根据信用卡 / 花呗 / 赊账等语义判断。",
        "categoryName 必须从给定分类里选，accountName 必须从给定账户里选；不确定就填 null。",
        `今天是 ${toDateInputValue(now)}。`,
        `分类：${JSON.stringify(categoryList)}`,
        `账户：${JSON.stringify(accountList)}`,
    ].join("\n");

    const content = await requestAiChat(
        input.config,
        [
            { role: "system", content: system },
            { role: "user", content: input.text },
        ],
        { temperature: 0, timeoutMs: 20_000 },
    );
    const parsed = extractJson(content) as {
        amount?: unknown;
        kind?: unknown;
        paymentMode?: unknown;
        categoryName?: unknown;
        accountName?: unknown;
        date?: unknown;
        note?: unknown;
    };
    const amount = Number(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(t("AI 没有识别到有效金额"));
    }
    const kind = parsed.kind === "income" ? "income" : "expense";
    const categoryName =
        typeof parsed.categoryName === "string" ? parsed.categoryName.trim() : "";
    const accountName =
        typeof parsed.accountName === "string" ? parsed.accountName.trim() : "";
    const namedAccount = accountName
        ? input.accounts
              .slice()
              .sort((a, b) => b.name.length - a.name.length)
              .find(
                  (item) =>
                      item.name === accountName ||
                      accountName.includes(item.name),
              )
        : undefined;
    const paymentMode =
        kind === "income"
            ? "asset"
            : namedAccount?.kind === "liability"
              ? "liability"
              : namedAccount?.kind === "asset"
                ? "asset"
                : parsed.paymentMode === "liability"
                  ? "liability"
                  : "asset";
    const category = input.categories
        .filter((item) => item.kind === kind)
        .sort((a, b) => b.name.length - a.name.length)
        .find(
            (item) =>
                item.name === categoryName ||
                categoryName.split(/[\/>]/).pop()?.trim() === item.name ||
                categoryName.includes(item.name),
        );
    const account =
        namedAccount &&
        (paymentMode === "liability"
            ? namedAccount.kind === "liability"
            : namedAccount.kind === "asset")
            ? namedAccount
            : input.accounts
                  .filter((item) =>
                      paymentMode === "liability"
                          ? item.kind === "liability"
                          : item.kind === "asset",
                  )
                  .sort((a, b) => b.name.length - a.name.length)
                  .find(
                      (item) =>
                          item.name === accountName ||
                          accountName.includes(item.name),
                  );
    const date =
        typeof parsed.date === "string"
            ? fromDateInputValue(parsed.date.slice(0, 10)) ?? now
            : now;
    return {
        kind,
        paymentMode,
        amount: Math.round(amount * 100),
        date,
        note:
            typeof parsed.note === "string" && parsed.note.trim()
                ? parsed.note.trim()
                : input.text,
        categoryId: category?.id,
        accountId: paymentMode === "asset" ? account?.id : undefined,
        liabilityAccountId:
            paymentMode === "liability" ? account?.id : undefined,
    };
}
