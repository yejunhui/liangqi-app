/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DailyExpense } from "@/domain/ledger";
import { formatCents, formatCentsPlain } from "@/domain/money";
import { formatWeekday } from "@/utils/date";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface MiniBarChartProps {
    data: DailyExpense[];
    currency: string;
    className?: string;
}

export function MiniBarChart({ data, currency, className }: MiniBarChartProps) {
    const max = Math.max(...data.map((item) => item.amount), 1);
    const total = data.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {total === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line bg-surface-2/35 text-[11px] text-muted">{t("这 7 天还没有支出")}</div>
            ) : (
                <div className="flex h-24 items-end gap-1.5">
                    {data.map((item) => {
                        const height =
                            item.amount === 0
                                ? 3
                                : Math.max(8, Math.round((item.amount / max) * 68));
                        return (
                            <div
                                key={item.timestamp}
                                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                                title={`${formatWeekday(item.timestamp)} ${formatCentsPlain(item.amount)}`}
                            >
                                <div
                                    className={cn(
                                        "w-full rounded-t-md transition-all",
                                        item.amount > 0
                                            ? "bg-accent/75 group-hover:bg-accent"
                                            : "bg-surface-3",
                                    )}
                                    style={{ height: `${height}px` }}
                                />
                                <span className="text-[9px] text-muted">
                                    {formatWeekday(item.timestamp).replace(t("周"), "")}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-muted">
                <span>{t("7 天走势")}</span>
                <span className="font-semibold tabular-nums text-text">
                    {formatCents(total, currency)}
                </span>
            </div>
        </div>
    );
}
