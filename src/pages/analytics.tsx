/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowUpRight,
    ChartNoAxesColumn,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    MapPin,
    ReceiptText,
    Tags,
    Users,
} from "lucide-react";
import type { Entry } from "@/types";
import { PageHeader } from "@/components/page-header";
import { EntryDetailModal } from "@/components/entry-detail-modal";
import { CategoryBars } from "@/components/category-bars";
import {
    getCategoryBreakdown,
    getMonthTotals,
} from "@/domain/ledger";
import { formatCents, formatPercent } from "@/domain/money";
import {
    formatMonthLabel,
    isInMonth,
    isSameMonth,
    startOfMonth,
} from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils/cn";

export function Analytics() {
    const entries = useLedgerStore((state) => state.entries);
    const categories = useLedgerStore((state) => state.categories);
    const tags = useLedgerStore((state) => state.tags);
    const members = useLedgerStore((state) => state.members);
    const currency = useCurrency();
    const [month, setMonth] = useState(() => startOfMonth(Date.now()));
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [activeLocationKey, setActiveLocationKey] = useState("");
    const [now] = useState(() => Date.now());

    const totals = useMemo(() => getMonthTotals(entries, month), [entries, month]);
    const previousMonth = useMemo(() => {
        const date = new Date(month);
        date.setMonth(date.getMonth() - 1);
        return startOfMonth(date.getTime());
    }, [month]);
    const previousTotals = useMemo(
        () => getMonthTotals(entries, previousMonth),
        [entries, previousMonth],
    );
    const canGoNext = !isSameMonth(month, now);

    const categoryRollup = useMemo(() => {
        const byParent = new Map<
            string,
            { name: string; emoji: string; color: string; amount: number }
        >();
        for (const item of getCategoryBreakdown(entries, categories, month)) {
            const category = categories.find((entry) => entry.id === item.categoryId);
            const root = category?.parent
                ? categories.find((entry) => entry.id === category.parent)
                : category;
            const key = root?.id ?? "uncategorized";
            const current = byParent.get(key) ?? {
                name: root?.name ?? "未分类",
                emoji: root?.emoji ?? "📦",
                color: root?.color ?? "#a8a29e",
                amount: 0,
            };
            current.amount += item.amount;
            byParent.set(key, current);
        }
        const list = [...byParent.entries()].map(([categoryId, value]) => ({
            categoryId,
            ...value,
        }));
        const total = list.reduce((sum, item) => sum + item.amount, 0);
        return list
            .map((item) => ({ ...item, share: total > 0 ? item.amount / total : 0 }))
            .sort((a, b) => b.amount - a.amount);
    }, [entries, categories, month]);
    const categoryItems = categoryRollup.map((item) => ({
        categoryId: item.categoryId,
        name: item.name,
        emoji: item.emoji,
        color: item.color,
        amount: item.amount,
        share: item.share,
    }));

    const tagBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of entries) {
            if (entry.kind !== "expense" || !isInMonth(entry.date, month)) {
                continue;
            }
            for (const tagId of new Set(entry.tagIds ?? [])) {
                map.set(tagId, (map.get(tagId) ?? 0) + entry.amount);
            }
        }
        const total = [...map.values()].reduce((sum, value) => sum + value, 0);
        return [...map.entries()]
            .map(([tagId, amount]) => {
                const tag = tags.find((item) => item.id === tagId);
                return {
                    id: tagId,
                    name: tag?.name ?? "已删除标签",
                    color: tag?.color ?? "#a8a29e",
                    amount,
                    share: total > 0 ? amount / total : 0,
                };
            })
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 8);
    }, [entries, tags, month]);

    const memberBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of entries) {
            if (entry.kind !== "expense" || !isInMonth(entry.date, month)) {
                continue;
            }
            const key = entry.memberId ?? "";
            map.set(key, (map.get(key) ?? 0) + entry.amount);
        }
        const total = [...map.values()].reduce((sum, value) => sum + value, 0);
        return [...map.entries()]
            .map(([memberId, amount]) => {
                const member = members.find((item) => item.id === memberId);
                return {
                    id: memberId || "unknown",
                    name: member?.name ?? "未指定",
                    color: member?.color ?? "#a8a29e",
                    amount,
                    share: total > 0 ? amount / total : 0,
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }, [entries, members, month]);

    const trend = useMemo(() => {
        return Array.from({ length: 6 }, (_, index) => {
            const offset = 5 - index;
            const date = new Date(month);
            date.setMonth(date.getMonth() - offset);
            const start = startOfMonth(date.getTime());
            return {
                start,
                ...getMonthTotals(entries, start),
            };
        });
    }, [entries, month]);
    const trendMax = Math.max(1, ...trend.flatMap((item) => [item.expense, item.income]));

    const topExpenses = useMemo(
        () =>
            entries
                .filter(
                    (entry) => entry.kind === "expense" && isInMonth(entry.date, month),
                )
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 8),
        [entries, month],
    );

    const locations = useMemo(() => {
        const map = new Map<
            string,
            { key: string; lat: number; lng: number; label: string; amount: number; count: number }
        >();
        for (const entry of entries) {
            if (entry.kind !== "expense" || !entry.location) {
                continue;
            }
            const lat = Number(entry.location.lat.toFixed(3));
            const lng = Number(entry.location.lng.toFixed(3));
            const key = `${lat},${lng}`;
            const current = map.get(key) ?? {
                key,
                lat,
                lng,
                label: entry.location.label ?? "",
                amount: 0,
                count: 0,
            };
            current.amount += entry.amount;
            current.count += 1;
            if (!current.label && entry.location.label) {
                current.label = entry.location.label;
            }
            map.set(key, current);
        }
        return [...map.values()].sort((a, b) => b.amount - a.amount);
    }, [entries]);
    const activeLocation =
        locations.find((item) => item.key === activeLocationKey) ?? locations[0];
    const mapDelta = 0.008;
    const mapUrl = activeLocation
        ? `https://www.openstreetmap.org/export/embed.html?bbox=${activeLocation.lng - mapDelta}%2C${activeLocation.lat - mapDelta}%2C${activeLocation.lng + mapDelta}%2C${activeLocation.lat + mapDelta}&layer=mapnik&marker=${activeLocation.lat}%2C${activeLocation.lng}`
        : "";

    function shiftMonth(delta: number) {
        setMonth((current) => {
            const next = new Date(current);
            next.setMonth(next.getMonth() + delta);
            return startOfMonth(next.getTime());
        });
    }

    const expenseChange =
        previousTotals.expense > 0
            ? (totals.expense - previousTotals.expense) / previousTotals.expense
            : null;
    const savingsRate = totals.income > 0 ? totals.net / totals.income : 0;

    return (
        <div>
            <PageHeader
                eyebrow="分析"
                title="钱都去哪了"
                description="按月查看收支、分类、标签和成员分布；点击大额支出可以查看详情。"
                action={
                    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/70 p-0.5">
                        <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-text"
                            aria-label="上个月"
                        >
                            <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="min-w-[5.5rem] text-center text-[10px] font-semibold text-text">
                            {formatMonthLabel(month)}
                        </span>
                        <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            disabled={!canGoNext}
                            className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="下个月"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                    label="本月支出"
                    value={totals.expense}
                    currency={currency}
                    hint={
                        expenseChange === null
                            ? "上月没有支出"
                            : `较上月 ${expenseChange >= 0 ? "+" : ""}${formatPercent(expenseChange, 1)}`
                    }
                    tone={expenseChange !== null && expenseChange > 0 ? "danger" : "muted"}
                />
                <Metric label="本月收入" value={totals.income} currency={currency} hint="工资、报销等" tone="success" />
                <Metric
                    label="结余"
                    value={totals.net}
                    currency={currency}
                    hint={`储蓄率 ${formatPercent(savingsRate, 1)}`}
                    tone={totals.net >= 0 ? "success" : "danger"}
                />
                <Metric
                    label="还款"
                    value={totals.repayment}
                    currency={currency}
                    hint="不计入支出"
                    tone="muted"
                />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <section className="card p-5 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-text">近 6 个月趋势</h2>
                            <p className="mt-0.5 text-[11px] text-muted">收入与支出对比</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted">
                            <span className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-liability" /> 支出
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-success" /> 收入
                            </span>
                        </div>
                    </div>
                    <div className="mt-5 flex h-44 items-end gap-2 sm:gap-3">
                        {trend.map((item) => (
                            <div key={item.start} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                                <div className="flex h-36 w-full items-end justify-center gap-1">
                                    <div
                                        className="w-2.5 rounded-t bg-liability/80 sm:w-3.5"
                                        style={{
                                            height: `${Math.max(
                                                2,
                                                (item.expense / trendMax) * 100,
                                            )}%`,
                                        }}
                                        title={formatCents(item.expense, currency)}
                                    />
                                    <div
                                        className="w-2.5 rounded-t bg-success/80 sm:w-3.5"
                                        style={{
                                            height: `${Math.max(
                                                2,
                                                (item.income / trendMax) * 100,
                                            )}%`,
                                        }}
                                        title={formatCents(item.income, currency)}
                                    />
                                </div>
                                <span className="truncate text-[9px] text-muted">
                                    {new Date(item.start).getMonth() + 1}月
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-text">分类占比</h2>
                            <p className="mt-0.5 text-[11px] text-muted">已合并二级分类</p>
                        </div>
                        <Link
                            to="/categories"
                            className="flex items-center gap-0.5 text-[10px] font-semibold text-accent hover:underline"
                        >
                            分类
                            <ArrowUpRight className="size-3" />
                        </Link>
                    </div>
                    <div className="mt-4">
                        <CategoryBars items={categoryItems} currency={currency} limit={6} />
                    </div>
                </section>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <BreakdownCard
                    icon={Tags}
                    title="标签支出"
                    description="同一笔流水多个标签会分别计入"
                    items={tagBreakdown}
                    currency={currency}
                    empty="这个月还没有带标签的支出"
                />
                <BreakdownCard
                    icon={Users}
                    title="成员支出"
                    description="按流水归属统计"
                    items={memberBreakdown}
                    currency={currency}
                    empty="这个月还没有支出"
                />
            </div>

            <section className="card mt-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <div>
                        <h2 className="flex items-center gap-1.5 text-sm font-bold text-text">
                            <ReceiptText className="size-4 text-muted" />
                            本月大额支出
                        </h2>
                        <p className="mt-0.5 text-[10px] text-muted">按金额从高到低</p>
                    </div>
                    <Link
                        to="/entries"
                        className="flex items-center gap-0.5 text-[10px] font-semibold text-accent hover:underline"
                    >
                        全部流水
                        <ArrowUpRight className="size-3" />
                    </Link>
                </div>
                {topExpenses.length === 0 ? (
                    <p className="px-4 py-10 text-center text-xs text-muted">
                        这个月还没有支出
                    </p>
                ) : (
                    <div className="divide-y divide-line/60">
                        {topExpenses.map((entry) => {
                            const category = categories.find(
                                (item) => item.id === entry.categoryId,
                            );
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => setSelectedEntry(entry)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60"
                                >
                                    <span
                                        className="grid size-9 shrink-0 place-items-center rounded-xl text-base"
                                        style={{
                                            backgroundColor: `${category?.color ?? "#a8a29e"}20`,
                                        }}
                                    >
                                        {category?.emoji ?? "📦"}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-text">
                                            {entry.note || category?.name || "支出"}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] text-muted">
                                            {category?.name ?? "未分类"} ·{" "}
                                            {new Date(entry.date).getMonth() + 1}/
                                            {new Date(entry.date).getDate()}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-xs font-bold tabular-nums text-text">
                                        {formatCents(entry.amount, currency)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="card mt-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-1.5 text-sm font-bold text-text">
                            <MapPin className="size-4 text-muted" />
                            消费足迹
                        </h2>
                        <p className="mt-0.5 text-[11px] text-muted">
                            记录了位置的支出会出现在这里，点击地点切换地图。
                        </p>
                    </div>
                    <span className="text-[10px] text-muted">
                        {locations.length} 个地点
                    </span>
                </div>

                {locations.length === 0 || !activeLocation ? (
                    <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-8 text-center text-[11px] leading-relaxed text-muted">
                        还没有带位置的支出。记账时点「获取当前位置」，就能在这里看到消费足迹。
                    </p>
                ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
                        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                            {locations.map((location) => {
                                const active = location.key === activeLocation.key;
                                return (
                                    <button
                                        key={location.key}
                                        type="button"
                                        onClick={() => setActiveLocationKey(location.key)}
                                        className={cn(
                                            "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                                            active
                                                ? "border-accent bg-accent-soft/60"
                                                : "border-line bg-surface hover:border-line-strong",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "grid size-7 shrink-0 place-items-center rounded-lg",
                                                active
                                                    ? "bg-accent text-surface"
                                                    : "bg-surface-2 text-muted",
                                            )}
                                        >
                                            <MapPin className="size-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[11px] font-semibold text-text">
                                                {location.label ||
                                                    `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                                            </span>
                                            <span className="mt-0.5 block text-[9px] text-muted">
                                                {location.count} 笔
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-text">
                                            {formatCents(location.amount, currency)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="overflow-hidden rounded-xl border border-line">
                            <iframe
                                key={activeLocation.key}
                                title="消费地点地图"
                                src={mapUrl}
                                className="h-80 w-full"
                                loading="lazy"
                            />
                            <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/45 px-3 py-2 text-[10px] text-muted">
                                <span>
                                    {activeLocation.label || "未命名地点"} ·{" "}
                                    {activeLocation.count} 笔
                                </span>
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${activeLocation.lat}&mlon=${activeLocation.lng}#map=16/${activeLocation.lat}/${activeLocation.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                                >
                                    打开地图
                                    <ExternalLink className="size-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <p className="mt-5 flex items-center justify-center gap-1 text-[10px] text-muted">
                <ChartNoAxesColumn className="size-3" />
                统计只包含支出和收入，转账和还款不会重复计入
            </p>

            <EntryDetailModal
                entry={selectedEntry}
                onClose={() => setSelectedEntry(null)}
            />
        </div>
    );
}

function Metric({
    label,
    value,
    currency,
    hint,
    tone,
}: {
    label: string;
    value: number;
    currency: string;
    hint: string;
    tone: "muted" | "success" | "danger";
}) {
    return (
        <div className="card p-4">
            <p className="text-[10px] text-muted">{label}</p>
            <p
                className={cn(
                    "mt-1 text-lg font-bold tabular-nums",
                    tone === "success"
                        ? "text-success"
                        : tone === "danger"
                          ? "text-danger"
                          : "text-text",
                )}
            >
                {formatCents(value, currency)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
        </div>
    );
}

function BreakdownCard({
    icon: Icon,
    title,
    description,
    items,
    currency,
    empty,
}: {
    icon: typeof Tags;
    title: string;
    description: string;
    items: Array<{ id: string; name: string; color: string; amount: number; share: number }>;
    currency: string;
    empty: string;
}) {
    return (
        <section className="card p-5">
            <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">
                    <Icon className="size-4" />
                </span>
                <div>
                    <h2 className="text-sm font-bold text-text">{title}</h2>
                    <p className="text-[10px] text-muted">{description}</p>
                </div>
            </div>
            {items.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-6 text-center text-[11px] text-muted">
                    {empty}
                </p>
            ) : (
                <div className="mt-4 space-y-3">
                    {items.map((item) => (
                        <div key={item.id}>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span
                                        className="size-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="truncate font-medium text-text">
                                        {item.name}
                                    </span>
                                    <span className="text-[9px] text-muted">
                                        {formatPercent(item.share, 0)}
                                    </span>
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-text">
                                    {formatCents(item.amount, currency)}
                                </span>
                            </div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
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
            )}
        </section>
    );
}
