/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Account, Bill, Category, Entry, Member, Tag } from "@/types";
import { Money } from "@/components/money";
import { formatCents } from "@/domain/money";
import { cn } from "@/utils/cn";

interface EntryRowProps {
    entry: Entry;
    accounts: Account[];
    bills: Bill[];
    categories: Category[];
    members: Member[];
    tags: Tag[];
    currency: string;
    onClick?: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggle?: () => void;
}

export function EntryRow({
    entry,
    accounts,
    bills,
    categories,
    members,
    tags,
    currency,
    onClick,
    selectable = false,
    selected = false,
    onToggle,
}: EntryRowProps) {
    const category = categories.find((item) => item.id === entry.categoryId);
    const parentCategory = category?.parent
        ? categories.find((item) => item.id === category.parent)
        : undefined;
    const bill = bills.find((item) => item.id === entry.billId);
    const asset = accounts.find((item) => item.id === entry.accountId);
    const liability = accounts.find((item) => item.id === entry.liabilityAccountId);
    const toAccount = accounts.find((item) => item.id === entry.toAccountId);
    const member = members.find((item) => item.id === entry.memberId);
    const entryTags = (entry.tagIds ?? [])
        .map((tagId) => tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is Tag => tag !== undefined);

    let emoji = category?.emoji ?? "📦";
    let title = category ? `${parentCategory ? `${parentCategory.name} / ` : ""}${category.name}` : "未分类";
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
    } else if (entry.kind === "transfer") {
        emoji = "🔀";
        title = "转账";
        subtitle = `${asset?.name ?? "账户"} → ${toAccount?.name ?? "账户"}`;
        sign = "none";
        amountClass = "text-muted";
        badge = {
            label: "不计收支",
            className: "bg-surface-3 text-muted",
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

    if (
        entry.originalAmount &&
        entry.originalAmount.currency !== currency
    ) {
        subtitle = `${subtitle} · ${formatCents(
            entry.originalAmount.amount,
            entry.originalAmount.currency,
        )} @ ${entry.originalAmount.rate}`;
    }

    return (
        <button
            type="button"
            onClick={selectable ? onToggle : onClick}
            aria-pressed={selectable ? selected : undefined}
            className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition",
                selectable
                    ? "hover:bg-surface-2/70"
                    : onClick
                      ? "hover:bg-surface-2/70"
                      : "cursor-default",
                selected && "bg-accent-soft/55",
            )}
        >
            {selectable && (
                <span
                    className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold transition",
                        selected
                            ? "border-accent bg-accent text-surface"
                            : "border-line-strong bg-surface text-transparent",
                    )}
                >
                    ✓
                </span>
            )}
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">
                {emoji}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-text">{title}</span>
                    {member && (
                        <span
                            className="chip"
                            style={{
                                backgroundColor: `${member.color}20`,
                                color: member.color,
                            }}
                        >
                            {member.name}
                        </span>
                    )}
                    {entry.ownerName && (
                        <span className="chip bg-surface-3 text-muted">
                            记 · {entry.ownerName}
                        </span>
                    )}
                    {badge && <span className={cn("chip", badge.className)}>{badge.label}</span>}
                    {entryTags.map((tag) => (
                        <span
                            key={tag.id}
                            className="chip"
                            style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                            }}
                        >
                            {tag.name}
                        </span>
                    ))}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">{subtitle}</span>
            </span>
            <span className={cn("shrink-0 text-sm font-bold", amountClass)}>
                <Money value={entry.amount} currency={currency} sign={sign} />
            </span>
        </button>
    );
}
