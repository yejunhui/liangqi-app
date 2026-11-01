/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Pencil, Trash2 } from "lucide-react";
import type { Account } from "@/types";
import { formatCents } from "@/domain/money";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface AccountCardProps {
    account: Account;
    balance: number;
    currency: string;
    billCount?: number;
    onEdit: () => void;
    onDelete: () => void;
}

export function AccountCard({
    account,
    balance,
    currency,
    billCount,
    onEdit,
    onDelete,
}: AccountCardProps) {
    const isLiability = account.kind === "liability";

    return (
        <article
            className={cn(
                "card group relative overflow-hidden p-4 transition hover:border-line-strong",
                isLiability && "bg-liability-soft/25",
            )}
        >
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">
                    {account.emoji}
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-text">{account.name}</h3>
                    <p className="mt-0.5 text-[11px] text-muted">
                        {isLiability
                            ? t("{0} 笔待还账单", [billCount ?? 0])
                            : `${account.note ?? t("储蓄账户")}${
                                  account.liquid === false ? t(" · 非流动") : ""
                              }`}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                        aria-label={t("编辑账户")}
                    >
                        <Pencil className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
                        aria-label={t("删除账户")}
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </div>

            <div className="mt-4">
                <p className="text-[10px] font-medium text-muted">
                    {isLiability ? t("待还负债") : t("当前余额")}
                </p>
                <p
                    className={cn(
                        "mt-0.5 text-xl font-bold tracking-tight tabular-nums",
                        isLiability
                            ? "text-liability"
                            : balance < 0
                              ? "text-danger"
                              : "text-text",
                    )}
                >
                    {formatCents(balance, currency)}
                </p>
            </div>
        </article>
    );
}
