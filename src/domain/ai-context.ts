/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Builds a compact, deterministic snapshot of the ledger for the AI assistant.
 * Only aggregates and a small recent sample are included; tokens, attachment
 * blobs and exact locations never leave the browser.
 */

import type { LedgerData } from "@/types";
import {
    getAccountBalance,
    getBillStatus,
    getCategoryBreakdown,
    getMonthTotals,
    getOpenBills,
    getOutstandingTotal,
    getTotals,
    isRecognizedExpense,
} from "@/domain/ledger";
import { getBudgetProgressList } from "@/domain/budgets";
import { formatCents } from "@/domain/money";
import {
    formatMonthLabel,
    isInMonth,
    startOfMonth,
    toDateInputValue,
} from "@/utils/date";

function monthStart(now: number, offset: number): number {
    const date = new Date(now);
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    return startOfMonth(date.getTime());
}

export function buildLedgerContext(
    data: LedgerData & { name?: string },
    now = Date.now(),
): string {
    const currency = data.settings.currency;
    const totals = getTotals(data);
    const month = startOfMonth(now);
    const monthTotals = getMonthTotals(data.entries, month);
    const previous = monthStart(now, -1);
    const previousTotals = getMonthTotals(data.entries, previous);
    const yearStart = new Date(now);
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const yearEntries = data.entries.filter(
        (entry) => entry.date >= yearStart.getTime() && entry.date <= now,
    );
    const yearExpense = yearEntries
        .filter(isRecognizedExpense)
        .reduce((sum, entry) => sum + entry.amount, 0);
    const yearIncome = yearEntries
        .filter((entry) => entry.kind === "income")
        .reduce((sum, entry) => sum + entry.amount, 0);

    const lines: string[] = [];
    lines.push(`账本：${data.name ?? "当前账本"}（本位币 ${currency}）`);
    lines.push(`今天：${toDateInputValue(now)}`);
    lines.push("");
    lines.push("## 资产");
    lines.push(
        `总资产 ${formatCents(totals.assets, currency)}；总负债 ${formatCents(
            totals.liabilities,
            currency,
        )}；净资产 ${formatCents(totals.netWorth, currency)}；可支配 ${formatCents(
            totals.disposable,
            currency,
        )}`,
    );
    lines.push(
        `账户：${data.accounts
            .map(
                (account) =>
                    `${account.name}（${
                        account.kind === "asset" ? "资产" : "负债"
                    } ${formatCents(getAccountBalance(account, data.entries), currency)}）`,
            )
            .join("；")}`,
    );
    lines.push("");
    lines.push("## 收支");
    lines.push(
        `本月（${formatMonthLabel(month)}）支出 ${formatCents(
            monthTotals.expense,
            currency,
        )}，收入 ${formatCents(monthTotals.income, currency)}，结余 ${formatCents(
            monthTotals.net,
            currency,
        )}，还款 ${formatCents(monthTotals.repayment, currency)}（计入支出）`,
    );
    lines.push(
        "口径：现金支出立即计入；赊账消费只记负债，还款时计入支出；转账不计收支。",
    );
    lines.push(
        `上月（${formatMonthLabel(previous)}）支出 ${formatCents(
            previousTotals.expense,
            currency,
        )}，收入 ${formatCents(previousTotals.income, currency)}`,
    );
    lines.push(
        `今年累计支出 ${formatCents(yearExpense, currency)}，收入 ${formatCents(
            yearIncome,
            currency,
        )}`,
    );
    lines.push("");
    lines.push("## 近 12 个月趋势");
    for (let index = 11; index >= 0; index -= 1) {
        const start = monthStart(now, -index);
        const totalsForMonth = getMonthTotals(data.entries, start);
        lines.push(
            `${formatMonthLabel(start)}：支出 ${formatCents(
                totalsForMonth.expense,
                currency,
            )}，收入 ${formatCents(totalsForMonth.income, currency)}`,
        );
    }
    lines.push("");
    lines.push("## 本月分类");
    const breakdown = getCategoryBreakdown(data.entries, data.categories, month);
    if (breakdown.length === 0) {
        lines.push("本月还没有支出。");
    } else {
        const parentNames = new Map(
            data.categories.map((category) => [category.id, category.name]),
        );
        for (const item of breakdown.slice(0, 15)) {
            const category = data.categories.find(
                (entry) => entry.id === item.categoryId,
            );
            const parent = category?.parent
                ? parentNames.get(category.parent)
                : undefined;
            lines.push(
                `${parent ? `${parent} / ` : ""}${item.name}：${formatCents(
                    item.amount,
                    currency,
                )}（${Math.round(item.share * 100)}%）`,
            );
        }
    }
    lines.push("");
    lines.push("## 本月标签与成员");
    const tagTotals = new Map<string, number>();
    const memberTotals = new Map<string, number>();
    for (const entry of data.entries) {
        if (!isRecognizedExpense(entry) || !isInMonth(entry.date, month)) {
            continue;
        }
        for (const tagId of new Set(entry.tagIds ?? [])) {
            tagTotals.set(tagId, (tagTotals.get(tagId) ?? 0) + entry.amount);
        }
        if (entry.memberId) {
            memberTotals.set(
                entry.memberId,
                (memberTotals.get(entry.memberId) ?? 0) + entry.amount,
            );
        }
    }
    lines.push(
        `标签：${
            [...tagTotals.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(
                    ([tagId, amount]) =>
                        `${data.tags.find((tag) => tag.id === tagId)?.name ?? "已删除标签"} ${formatCents(
                            amount,
                            currency,
                        )}`,
                )
                .join("；") || "无"
        }`,
    );
    lines.push(
        `成员：${
            [...memberTotals.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(
                    ([memberId, amount]) =>
                        `${data.members.find((member) => member.id === memberId)?.name ?? "未知成员"} ${formatCents(
                            amount,
                            currency,
                        )}`,
                )
                .join("；") || "无"
        }`,
    );
    lines.push("");
    lines.push("## 预算");
    if (data.budgets.length === 0) {
        lines.push("还没有设置预算。");
    } else {
        for (const progress of getBudgetProgressList(
            data.budgets,
            data.entries,
            data.categories,
            now,
        )) {
            lines.push(
                `${progress.budget.name}（${progress.periodLabel}）：已用 ${formatCents(
                    progress.spent,
                    currency,
                )} / ${formatCents(progress.budget.amount, currency)}，剩余 ${formatCents(
                    progress.remaining,
                    currency,
                )}${progress.spent > progress.budget.amount ? "（已超支）" : ""}`,
            );
        }
    }
    lines.push("");
    lines.push("## 待还账单");
    const openBills = getOpenBills(data.bills, data.entries);
    lines.push(
        `共 ${openBills.length} 笔，待还合计 ${formatCents(
            getOutstandingTotal(data.bills, data.entries),
            currency,
        )}`,
    );
    for (const bill of openBills.slice(0, 10)) {
        const remaining = Math.max(
            0,
            bill.principal -
                data.entries
                    .filter(
                        (entry) =>
                            entry.kind === "repayment" && entry.billId === bill.id,
                    )
                    .reduce((sum, entry) => sum + entry.amount, 0),
        );
        lines.push(
            `${bill.title}：待还 ${formatCents(remaining, currency)}${
                bill.dueDate ? `，到期 ${toDateInputValue(bill.dueDate)}` : ""
            }${getBillStatus(bill, data.entries) === "partial" ? "，部分还款" : ""}`,
        );
    }
    lines.push("");
    lines.push("## 最近流水（最多 25 条）");
    const recent = [...data.entries]
        .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)
        .slice(0, 25);
    for (const entry of recent) {
        const category = data.categories.find(
            (item) => item.id === entry.categoryId,
        );
        const member = data.members.find((item) => item.id === entry.memberId);
        const tags = (entry.tagIds ?? [])
            .map((tagId) => data.tags.find((tag) => tag.id === tagId)?.name)
            .filter(Boolean)
            .join("/");
        const kind =
            entry.kind === "expense"
                ? entry.billId
                    ? "赊账"
                    : "支出"
                : entry.kind === "income"
                  ? "收入"
                  : entry.kind === "transfer"
                    ? "转账"
                    : "还款";
        lines.push(
            `${toDateInputValue(entry.date)} ${kind} ${formatCents(
                entry.amount,
                currency,
            )}${category ? ` · ${category.name}` : ""}${
                entry.note ? ` · ${entry.note}` : ""
            }${member ? ` · ${member.name}` : ""}${tags ? ` · #${tags}` : ""}${
                entry.ownerName ? ` · 记账人 ${entry.ownerName}` : ""
            }`,
        );
    }
    return lines.join("\n");
}
