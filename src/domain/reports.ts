/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Account, Category, Entry, Member, Tag } from "@/types";
import { formatCents } from "@/domain/money";
import { isRecognizedExpense } from "@/domain/ledger";
import { toDateInputValue } from "@/utils/date";
import { getLocale, t } from "@/i18n";

const KIND_LABELS = {
    expense: "支出",
    income: "收入",
    repayment: "还款",
    transfer: "转账",
} as const;

function entryKindLabel(entry: Entry): string {
    if (entry.kind === "expense" && entry.billId) {
        return t("赊账");
    }
    return t(KIND_LABELS[entry.kind]);
}

function csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

function entryCategoryName(entry: Entry, categories: Category[]): string {
    const category = categories.find((item) => item.id === entry.categoryId);
    if (!category) {
        return "";
    }
    const parent = category.parent
        ? categories.find((item) => item.id === category.parent)
        : undefined;
    return parent ? `${parent.name} / ${category.name}` : category.name;
}

function entryAccountName(entry: Entry, accounts: Account[]): string {
    const asset = accounts.find((item) => item.id === entry.accountId);
    const liability = accounts.find((item) => item.id === entry.liabilityAccountId);
    if (entry.kind === "transfer") {
        const to = accounts.find((item) => item.id === entry.toAccountId);
        return `${asset?.name ?? ""} → ${to?.name ?? ""}`;
    }
    if (entry.kind === "repayment") {
        return asset?.name ?? liability?.name ?? "";
    }
    if (entry.kind === "expense" && entry.billId) {
        return liability?.name ?? "";
    }
    return asset?.name ?? liability?.name ?? "";
}

export function createEntriesCsv(input: {
    entries: Entry[];
    categories: Category[];
    accounts: Account[];
    members: Member[];
    tags: Tag[];
}): string {
    const header = [
        t("日期"),
        t("类型"),
        t("金额"),
        t("分类"),
        t("账户"),
        t("成员"),
        t("记账人"),
        t("标签"),
        t("备注"),
        t("币种"),
    ];
    const rows = input.entries
        .slice()
        .sort((a, b) => a.date - b.date || a.createdAt - b.createdAt)
        .map((entry) => {
            const tags = (entry.tagIds ?? [])
                .map((id) => input.tags.find((tag) => tag.id === id)?.name)
                .filter(Boolean)
                .join(" / ");
            const member = input.members.find((item) => item.id === entry.memberId);
            return [
                toDateInputValue(entry.date),
                entryKindLabel(entry),
                (entry.amount / 100).toFixed(2),
                entryCategoryName(entry, input.categories),
                entryAccountName(entry, input.accounts),
                member?.name ?? "",
                entry.ownerName ?? "",
                tags,
                entry.note ?? "",
                "",
            ];
        });
    return `\uFEFF${[header, ...rows]
        .map((row) => row.map((cell) => csvCell(cell)).join(","))
        .join("\r\n")}`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function categoryTotals(entries: Entry[], categories: Category[]): Array<{
    name: string;
    amount: number;
}> {
    const totals = new Map<string, number>();
    for (const entry of entries) {
        if (!isRecognizedExpense(entry)) {
            continue;
        }
        const name = entryCategoryName(entry, categories) || "未分类";
        totals.set(name, (totals.get(name) ?? 0) + entry.amount);
    }
    return [...totals.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
}

export function buildReportHtml(input: {
    title: string;
    periodLabel: string;
    currency: string;
    entries: Entry[];
    categories: Category[];
    accounts: Account[];
    members: Member[];
    tags: Tag[];
}): string {
    const expense = input.entries
        .filter(isRecognizedExpense)
        .reduce((sum, entry) => sum + entry.amount, 0);
    const income = input.entries
        .filter((entry) => entry.kind === "income")
        .reduce((sum, entry) => sum + entry.amount, 0);
    const repayment = input.entries
        .filter((entry) => entry.kind === "repayment")
        .reduce((sum, entry) => sum + entry.amount, 0);
    const categories = categoryTotals(input.entries, input.categories);
    const net = income - expense;
    const rows = input.entries
        .slice()
        .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)
        .map((entry) => {
            const member = input.members.find((item) => item.id === entry.memberId);
            return `<tr>
                <td>${toDateInputValue(entry.date)}</td>
                <td>${entryKindLabel(entry)}</td>
                <td>${escapeHtml(entryCategoryName(entry, input.categories) || "-")}</td>
                <td>${escapeHtml(entryAccountName(entry, input.accounts))}</td>
                <td>${escapeHtml(member?.name ?? "")}</td>
                <td>${escapeHtml(entry.ownerName ?? "")}</td>
                <td>${escapeHtml(entry.note ?? "")}</td>
                <td class="amount">${formatCents(entry.amount, input.currency)}</td>
            </tr>`;
        })
        .join("");
    const categoryRows = categories
        .map(
            (item) =>
                `<tr><td>${escapeHtml(item.name)}</td><td class="amount">${formatCents(
                    item.amount,
                    input.currency,
                )}</td></tr>`,
        )
        .join("");

    return `<!doctype html>
<html lang="${getLocale()}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)} · ${escapeHtml(input.periodLabel)}</title>
<style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; color: #1c1917; background: #fff; }
    h1 { margin: 0 0 4px; font-size: 26px; }
    h2 { margin: 28px 0 12px; font-size: 16px; }
    .muted { color: #78716c; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; }
    .metric { border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px; }
    .metric p { margin: 0; font-size: 11px; color: #78716c; }
    .metric strong { display: block; margin-top: 6px; font-size: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #e7e5e4; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { color: #78716c; font-weight: 600; }
    .amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .footer { margin-top: 28px; color: #a8a29e; font-size: 10px; }
    @media print { body { padding: 12mm; } .no-print { display: none; } }
</style>
</head>
<body>
    <h1>${escapeHtml(input.title)}</h1>
    <p class="muted">${escapeHtml(input.periodLabel)} · ${t("本位币")} ${escapeHtml(input.currency)} · ${t("生成于")} ${new Date().toLocaleString(getLocale())}</p>
    <div class="summary">
        <div class="metric"><p>${t("支出")}</p><strong>${formatCents(expense, input.currency)}</strong></div>
        <div class="metric"><p>${t("收入")}</p><strong>${formatCents(income, input.currency)}</strong></div>
        <div class="metric"><p>${t("结余")}</p><strong>${formatCents(net, input.currency)}</strong></div>
        <div class="metric"><p>${t("还款（计入支出）")}</p><strong>${formatCents(repayment, input.currency)}</strong></div>
    </div>
    <div class="grid">
        <section>
            <h2>${t("分类支出")}</h2>
            <table><thead><tr><th>${t("分类")}</th><th class="amount">${t("金额")}</th></tr></thead><tbody>${categoryRows || `<tr><td colspan="2" class="muted">${t("没有支出")}</td></tr>`}</tbody></table>
        </section>
        <section>
            <h2>${t("说明")}</h2>
            <p class="muted">${t("赊账消费只记负债，还款时计入支出；转账不计入支出。外币按记账时汇率换算成本位币。")}</p>
            <p class="muted">${t("共 {0} 笔流水。", [input.entries.length])}</p>
        </section>
    </div>
    <h2>${t("流水明细")}</h2>
    <table>
        <thead><tr><th>${t("日期")}</th><th>${t("类型")}</th><th>${t("分类")}</th><th>${t("账户")}</th><th>${t("成员")}</th><th>${t("记账人")}</th><th>${t("备注")}</th><th class="amount">${t("金额")}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8" class="muted">${t("没有流水")}</td></tr>`}</tbody>
    </table>
    <p class="footer">${t("两讫 · 本地优先记账 · 数据以账本为准")}</p>
    <p class="no-print" style="margin-top:24px"><button onclick="window.print()">${t("打印 / 保存为 PDF")}</button></p>
</body>
</html>`;
}

export function openReportPrint(html: string): void {
    const win = window.open("", "_blank");
    if (!win) {
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 350);
}
