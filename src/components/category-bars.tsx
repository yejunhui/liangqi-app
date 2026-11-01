/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { CategoryBreakdownItem } from "@/domain/ledger";
import { formatCents } from "@/domain/money";
import { formatPercent } from "@/domain/money";

import { t } from "@/i18n";

interface CategoryBarsProps {
    items: CategoryBreakdownItem[];
    currency: string;
    limit?: number;
}

export function CategoryBars({ items, currency, limit }: CategoryBarsProps) {
    const visible = limit ? items.slice(0, limit) : items;

    if (visible.length === 0) {
        return (<p className="py-6 text-center text-xs text-muted">{t("这个月还没有支出，记一笔就能看到分类占比。")}</p>);
    }

    return (
        <div className="space-y-3">
            {visible.map((item) => (
                <div key={item.categoryId ?? "uncategorized"}>
                    <div className="flex items-center gap-2 text-xs">
                        <span
                            className="grid size-6 shrink-0 place-items-center rounded-md text-xs"
                            style={{ backgroundColor: `${item.color}20` }}
                        >
                            {item.emoji}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-text">
                            {item.name}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted">
                            {formatPercent(item.share)}
                        </span>
                        <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-text">
                            {formatCents(item.amount, currency)}
                        </span>
                    </div>
                    <div className="ml-8 mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.max(2, item.share * 100)}%`,
                                backgroundColor: item.color,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
