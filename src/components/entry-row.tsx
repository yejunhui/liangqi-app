/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Account, Bill, Category, Entry } from "@/types";
import { Money } from "@/components/money";
import { cn } from "@/utils/cn";

interface EntryRowProps {
    entry: Entry;
    accounts: Account[];
    bills: Bill[];
    categories: Category[];
    currency: string;
    onClick?: () => void;
}

export function EntryRow({ entry, accounts, bills, categories, currency, onClick }: EntryRowProps) {
    const category = categories.find((item) => item.id === entry.categoryId);
    const bill = bills.find((item) => item.id === entry.billId);
    const asset = accounts.find((item) => item.id === entry.accountId);
    const liability = accounts.find((item) => item.id === entry.liabilityAccountId);

    let emoji = category?.emoji ?? "📦";
    let title = category?.name ?? "未分类";
    let subtitle = asset?.name ?? "未指定账户";
    let sign: "positive" | "negative" | "none" = "negative";
    let amountClass = "text-text";
    let badge: { label: string; className: string } | undefined;

    if (entry.kind === "income") {
        sign = "positive";
        amountClass = "text-success";
    } else if (entry.kind === "repayment") {
        emoji = "🔁";
        title = bill ? `还款 · ${bill.title}` : "还款";
        subtitle = `${asset?.name ?? "账户"} → ${liability?.name ?? "负债"}`;
        amountClass = "text-muted";
        badge = {
            label: "不计支出",
            className: "bg-accent-soft text-accent",
        };
    } else if (entry.billId) {
        title = bill?.title ?? category?.name ?? "赊账支出";
        subtitle = `${liability?.name ?? "负债"} · 赊账`;
        amountClass = "text-liability";
        badge = {
            label: "负债",
            className: "bg-liability-soft text-liability",
        };
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition",
                onClick ? "hover:bg-surface-2/70" : "cursor-default",
            )}
        >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">
                {emoji}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-text">{title}</span>
                    {badge && <span className={cn("chip", badge.className)}>{badge.label}</span>}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">{subtitle}</span>
            </span>
            <span className={cn("shrink-0 text-sm font-bold", amountClass)}>
                <Money value={entry.amount} currency={currency} sign={sign} />
            </span>
        </button>
    );
}
