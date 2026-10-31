/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Pencil, Trash2 } from "lucide-react";
import type { Account, Bill, Category, Entry } from "@/types";
import { getBillDueInfo, getBillProgress, getBillRemaining, getBillStatus } from "@/domain/ledger";
import { formatCents } from "@/domain/money";
import { Button } from "@/components/button";
import { cn } from "@/utils/cn";

interface BillCardProps {
    bill: Bill;
    entries: Entry[];
    accounts: Account[];
    categories: Category[];
    currency: string;
    onRepay: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const statusStyles = {
    open: "bg-liability-soft text-liability",
    partial: "bg-accent-soft text-accent",
    paid: "bg-success-soft text-success",
};

const statusLabels = {
    open: "待还",
    partial: "部分还款",
    paid: "已还清",
};

const dueStyles = {
    neutral: "text-muted",
    warning: "text-liability",
    danger: "text-danger",
    success: "text-success",
};

export function BillCard({
    bill,
    entries,
    accounts,
    categories,
    currency,
    onRepay,
    onEdit,
    onDelete,
}: BillCardProps) {
    const status = getBillStatus(bill, entries);
    const remaining = getBillRemaining(bill, entries);
    const progress = getBillProgress(bill, entries);
    const due = getBillDueInfo(bill, status);
    const repaid = bill.principal - remaining;
    const category = categories.find((item) => item.id === bill.categoryId);
    const liability = accounts.find((item) => item.id === bill.liabilityAccountId);
    const canDelete = !bill.opening && repaid === 0;

    return (
        <article
            className={cn(
                "card p-4 transition hover:border-line-strong",
                status === "paid" && "opacity-80",
            )}
        >
            <div className="flex items-start gap-3">
                <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-lg"
                    style={{ backgroundColor: `${category?.color ?? "#a8a29e"}20` }}
                >
                    {category?.emoji ?? "🧾"}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-text">{bill.title}</h3>
                        <span className={cn("chip", statusStyles[status])}>
                            {statusLabels[status]}
                        </span>
                        {bill.opening && (
                            <span className="chip bg-surface-3 text-muted">期初</span>
                        )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                        {liability?.name ?? "负债账户"}
                        {category ? ` · ${category.name}` : ""}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-text">
                        {formatCents(remaining, currency)}
                    </p>
                    <p className="text-[10px] text-muted">待还</p>
                </div>
            </div>

            <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{
                            width:
                                progress === 0
                                    ? "0%"
                                    : `${Math.max(2, Math.min(100, progress * 100))}%`,
                        }}
                    />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-muted">
                        已还 {formatCents(repaid, currency)} / {formatCents(bill.principal, currency)}
                    </span>
                    <span className={dueStyles[due.tone]}>{due.label}</span>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5">
                {remaining > 0 ? (
                    <Button size="sm" onClick={onRepay} className="flex-1">
                        还款
                    </Button>
                ) : (
                    <span className="flex-1 text-[11px] font-medium text-success">
                        这笔账单已经结清
                    </span>
                )}
                <button
                    type="button"
                    onClick={onEdit}
                    className="grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-surface-2 hover:text-text"
                    aria-label="编辑账单"
                >
                    <Pencil className="size-3.5" />
                </button>
                {canDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
                        aria-label="删除账单"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                )}
            </div>
        </article>
    );
}
