/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowUpRight,
    Bookmark,
    ChartNoAxesColumn,
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    MapPin,
    Printer,
    ReceiptText,
    SlidersHorizontal,
    Tags,
    Trash2,
    Users,
    X,
} from "lucide-react";
import type { Entry } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { EntryDetailModal } from "@/components/entry-detail-modal";
import { CategoryBars } from "@/components/category-bars";
import {
    getCategoryBreakdown,
    getMonthTotals,
    isRecognizedExpense,
} from "@/domain/ledger";
import { filterEntries, type EntryFilter } from "@/domain/filters";
import { formatCents, formatPercent } from "@/domain/money";
import { buildReportHtml, createEntriesCsv, openReportPrint } from "@/domain/reports";
import { downloadText } from "@/utils/download";
import {
    endOfMonth,
    formatMonthLabel,
    isInMonth,
    isSameMonth,
    startOfMonth,
    toDateInputValue,
} from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import {
    useAnalysisViewStore,
    type AnalysisView,
} from "@/store/analysis-views";
import { cn } from "@/utils/cn";

import { getLocale, t } from "@/i18n";

const EMPTY_VIEWS: AnalysisView[] = [];

export function Analytics() {
    const bookId = useLedgerStore((state) => state.id);
    const entries = useLedgerStore((state) => state.entries);
    const categories = useLedgerStore((state) => state.categories);
    const tags = useLedgerStore((state) => state.tags);
    const members = useLedgerStore((state) => state.members);
    const accounts = useLedgerStore((state) => state.accounts);
    const currency = useCurrency();
    const [month, setMonth] = useState(() => startOfMonth(Date.now()));
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [activeLocationKey, setActiveLocationKey] = useState("");
    const [now] = useState(() => Date.now());
    const [filterOpen, setFilterOpen] = useState(false);
    const [filter, setFilter] = useState({
        categoryId: "",
        memberId: "",
        accountId: "",
        tagId: "",
        keyword: "",
    });
    const [selectedViewId, setSelectedViewId] = useState("");
    const [saveOpen, setSaveOpen] = useState(false);
    const [viewName, setViewName] = useState("");
    const views = useAnalysisViewStore((state) => {
        const list = state.byBook[bookId];
        return Array.isArray(list) ? list : EMPTY_VIEWS;
    });
    const addView = useAnalysisViewStore((state) => state.addView);
    const deleteView = useAnalysisViewStore((state) => state.deleteView);

    const baseFilter = useMemo<EntryFilter>(
        () => ({
            categoryId: filter.categoryId || undefined,
            memberId: filter.memberId || undefined,
            accountId: filter.accountId || undefined,
            tagId: filter.tagId || undefined,
            keyword: filter.keyword.trim() || undefined,
        }),
        [filter],
    );
    const activeFilterCount = Object.values(filter).filter(
        (value) => value.trim() !== "",
    ).length;
    const filteredMonthEntries = useMemo(
        () =>
            filterEntries(
                entries,
                { ...baseFilter, start: month, end: endOfMonth(month) },
                categories,
            ),
        [entries, baseFilter, month, categories],
    );

    const totals = useMemo(
        () => getMonthTotals(filteredMonthEntries, month),
        [filteredMonthEntries, month],
    );
    const previousMonth = useMemo(() => {
        const date = new Date(month);
        date.setMonth(date.getMonth() - 1);
        return startOfMonth(date.getTime());
    }, [month]);
    const previousTotals = useMemo(
        () =>
            getMonthTotals(
                filterEntries(
                    entries,
                    {
                        ...baseFilter,
                        start: previousMonth,
                        end: endOfMonth(previousMonth),
                    },
                    categories,
                ),
                previousMonth,
            ),
        [entries, baseFilter, previousMonth, categories],
    );
    const canGoNext = !isSameMonth(month, now);

    const categoryRollup = useMemo(() => {
        const byParent = new Map<
            string,
            { name: string; emoji: string; color: string; amount: number }
        >();
        for (const item of getCategoryBreakdown(
            filteredMonthEntries,
            categories,
            month,
        )) {
            const category = categories.find((entry) => entry.id === item.categoryId);
            const root = category?.parent
                ? categories.find((entry) => entry.id === category.parent)
                : category;
            const key = root?.id ?? "uncategorized";
            const current = byParent.get(key) ?? {
                name: root?.name ?? t("未分类"),
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
    }, [filteredMonthEntries, categories, month]);
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
        for (const entry of filteredMonthEntries) {
            if (!isRecognizedExpense(entry) || !isInMonth(entry.date, month)) {
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
                    name: tag?.name ?? t("已删除标签"),
                    color: tag?.color ?? "#a8a29e",
                    amount,
                    share: total > 0 ? amount / total : 0,
                };
            })
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 8);
    }, [filteredMonthEntries, tags, month]);

    const memberBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of filteredMonthEntries) {
            if (!isRecognizedExpense(entry) || !isInMonth(entry.date, month)) {
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
                    name: member?.name ?? t("未指定"),
                    color: member?.color ?? "#a8a29e",
                    amount,
                    share: total > 0 ? amount / total : 0,
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }, [filteredMonthEntries, members, month]);

    const trend = useMemo(() => {
        return Array.from({ length: 6 }, (_, index) => {
            const offset = 5 - index;
            const date = new Date(month);
            date.setMonth(date.getMonth() - offset);
            const start = startOfMonth(date.getTime());
            const monthly = filterEntries(
                entries,
                {
                    ...baseFilter,
                    start,
                    end: endOfMonth(start),
                },
                categories,
            );
            return {
                start,
                ...getMonthTotals(monthly, start),
            };
        });
    }, [entries, baseFilter, categories, month]);
    const trendMax = Math.max(1, ...trend.flatMap((item) => [item.expense, item.income]));

    const topExpenses = useMemo(
        () =>
            filteredMonthEntries
                .filter(isRecognizedExpense)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 8),
        [filteredMonthEntries],
    );

    const locations = useMemo(() => {
        const map = new Map<
            string,
            { key: string; lat: number; lng: number; label: string; amount: number; count: number }
        >();
        for (const entry of entries) {
            if (!isRecognizedExpense(entry) || !entry.location) {
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

    function applyView(view: AnalysisView | undefined) {
        setSelectedViewId(view?.id ?? "");
        setFilter({
            categoryId: view?.filter.categoryId ?? "",
            memberId: view?.filter.memberId ?? "",
            accountId: view?.filter.accountId ?? "",
            tagId: view?.filter.tagId ?? "",
            keyword: view?.filter.keyword ?? "",
        });
    }

    function clearFilters() {
        setSelectedViewId("");
        setFilter({
            categoryId: "",
            memberId: "",
            accountId: "",
            tagId: "",
            keyword: "",
        });
    }

    function saveView() {
        if (!viewName.trim()) {
            return;
        }
        const id = addView(bookId, viewName, baseFilter);
        setSelectedViewId(id);
        setViewName("");
        setSaveOpen(false);
    }

    function exportCsv() {
        downloadText(
            `liangqi-${toDateInputValue(month).slice(0, 7)}.csv`,
            createEntriesCsv({
                entries: filteredMonthEntries,
                categories,
                accounts,
                members,
                tags,
            }),
            "text/csv;charset=utf-8",
        );
    }

    function printReport() {
        openReportPrint(
            buildReportHtml({
                title: t("两讫月报"),
                periodLabel: formatMonthLabel(month),
                currency,
                entries: filteredMonthEntries,
                categories,
                accounts,
                members,
                tags,
            }),
        );
    }

    const expenseChange =
        previousTotals.expense > 0
            ? (totals.expense - previousTotals.expense) / previousTotals.expense
            : null;
    const savingsRate = totals.income > 0 ? totals.net / totals.income : 0;

    return (
        <div>
            <PageHeader
                eyebrow={t("分析")}
                title={t("钱都去哪了")}
                description={t("按月查看收支、分类、标签和成员分布；点击大额支出可以查看详情。")}
                action={
                    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/70 p-0.5">
                        <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-text"
                            aria-label={t("上个月")}
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
                            aria-label={t("下个月")}
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                }
            />

            <section className="card mb-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">
                            <SlidersHorizontal className="size-4" />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-text">{t("自定义分析")}</h2>
                            <p className="text-[10px] text-muted">{t("组合分类、标签、账户、成员和关键词，保存成自己的分析视图")}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            className="field w-auto min-w-[8rem] py-1.5 text-[11px]"
                            value={selectedViewId}
                            onChange={(event) => {
                                const view = views.find(
                                    (item) => item.id === event.target.value,
                                );
                                applyView(view);
                            }}
                        >
                            <option value="">{t("未保存视图")}</option>
                            {views.map((view) => (
                                <option key={view.id} value={view.id}>
                                    {view.name}
                                </option>
                            ))}
                        </select>
                        {selectedViewId && (
                            <button
                                type="button"
                                onClick={() => {
                                    deleteView(bookId, selectedViewId);
                                    setSelectedViewId("");
                                }}
                                className="grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
                                aria-label={t("删除分析视图")}
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        )}
                        <Button
                            size="sm"
                            variant={filterOpen || activeFilterCount > 0 ? "primary" : "secondary"}
                            onClick={() => setFilterOpen((current) => !current)}
                        >
                            <SlidersHorizontal className="size-3.5" />{` ${t("筛选")} `}{activeFilterCount > 0 && (
                                <span className="rounded-full bg-surface/25 px-1.5 text-[10px]">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSaveOpen(true)}
                            disabled={activeFilterCount === 0}
                        >
                            <Bookmark className="size-3.5" />{` ${t("保存视图")}`}</Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={exportCsv}
                            disabled={filteredMonthEntries.length === 0}
                        >
                            <Download className="size-3.5" />
                            CSV
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={printReport}
                            disabled={filteredMonthEntries.length === 0}
                        >
                            <Printer className="size-3.5" />
                            PDF
                        </Button>
                    </div>
                </div>

                {filterOpen && (
                    <div className="mt-4 border-t border-line pt-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("分类")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={filter.categoryId}
                                    onChange={(event) => {
                                        setSelectedViewId("");
                                        setFilter((current) => ({
                                            ...current,
                                            categoryId: event.target.value,
                                        }));
                                    }}
                                >
                                    <option value="">{t("全部分类")}</option>
                                    {categories.map((category) => {
                                        const parent = category.parent
                                            ? categories.find(
                                                  (item) => item.id === category.parent,
                                              )
                                            : undefined;
                                        return (
                                            <option key={category.id} value={category.id}>
                                                {category.emoji}{" "}
                                                {parent ? `${parent.name} / ` : ""}
                                                {category.name}
                                            </option>
                                        );
                                    })}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("标签")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={filter.tagId}
                                    onChange={(event) => {
                                        setSelectedViewId("");
                                        setFilter((current) => ({
                                            ...current,
                                            tagId: event.target.value,
                                        }));
                                    }}
                                >
                                    <option value="">{t("全部标签")}</option>
                                    {tags.map((tag) => (
                                        <option key={tag.id} value={tag.id}>
                                            {tag.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("成员")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={filter.memberId}
                                    onChange={(event) => {
                                        setSelectedViewId("");
                                        setFilter((current) => ({
                                            ...current,
                                            memberId: event.target.value,
                                        }));
                                    }}
                                >
                                    <option value="">{t("全部成员")}</option>
                                    {members.map((member) => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("账户")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={filter.accountId}
                                    onChange={(event) => {
                                        setSelectedViewId("");
                                        setFilter((current) => ({
                                            ...current,
                                            accountId: event.target.value,
                                        }));
                                    }}
                                >
                                    <option value="">{t("全部账户")}</option>
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.emoji} {account.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("关键词")}</span>
                                <input
                                    className="field py-2 text-xs"
                                    value={filter.keyword}
                                    onChange={(event) => {
                                        setSelectedViewId("");
                                        setFilter((current) => ({
                                            ...current,
                                            keyword: event.target.value,
                                        }));
                                    }}
                                    placeholder={t("备注、分类、记账人")}
                                />
                            </label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] text-muted">{t("分析视图保存在本机，按账本区分；上方月份仍然是时间维度。")}</p>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={clearFilters}
                                disabled={activeFilterCount === 0}
                            >
                                <X className="size-3.5" />{` ${t("清空筛选")}`}</Button>
                        </div>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                    label={t("本月支出")}
                    value={totals.expense}
                    currency={currency}
                    hint={
                        expenseChange === null
                            ? t("上月没有支出")
                            : t(
                            "较上月 {0}{1}",
                            [expenseChange >= 0 ? "+" : "", formatPercent(expenseChange, 1)]
                        )
                    }
                    tone={expenseChange !== null && expenseChange > 0 ? "danger" : "muted"}
                />
                <Metric label={t("本月收入")} value={totals.income} currency={currency} hint={t("工资、报销等")} tone="success" />
                <Metric
                    label={t("结余")}
                    value={totals.net}
                    currency={currency}
                    hint={t("储蓄率 {0}", [formatPercent(savingsRate, 1)])}
                    tone={totals.net >= 0 ? "success" : "danger"}
                />
                <Metric
                    label={t("还款")}
                    value={totals.repayment}
                    currency={currency}
                    hint={t("不计支出")}
                    tone="muted"
                />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <section className="card p-5 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-text">{t("近 6 个月趋势")}</h2>
                            <p className="mt-0.5 text-[11px] text-muted">{t("收入与支出对比")}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted">
                            <span className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-liability" />{` ${t("支出")}`}</span>
                            <span className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-success" />{` ${t("收入")}`}</span>
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
                                    {new Intl.DateTimeFormat(getLocale(), {
                                        month: "short",
                                    }).format(item.start)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-text">{t("分类占比")}</h2>
                            <p className="mt-0.5 text-[11px] text-muted">{t("已合并二级分类")}</p>
                        </div>
                        <Link
                            to="/categories"
                            className="flex items-center gap-0.5 text-[10px] font-semibold text-accent hover:underline"
                        >{`${t("分类")} `}<ArrowUpRight className="size-3" />
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
                    title={t("标签支出")}
                    description={t("同一笔流水多个标签会分别计入")}
                    items={tagBreakdown}
                    currency={currency}
                    empty={t("这个月还没有带标签的支出")}
                />
                <BreakdownCard
                    icon={Users}
                    title={t("成员支出")}
                    description={t("按流水归属统计")}
                    items={memberBreakdown}
                    currency={currency}
                    empty={t("这个月还没有支出")}
                />
            </div>

            <section className="card mt-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <div>
                        <h2 className="flex items-center gap-1.5 text-sm font-bold text-text">
                            <ReceiptText className="size-4 text-muted" />{` ${t("本月大额支出")}`}</h2>
                        <p className="mt-0.5 text-[10px] text-muted">{t("按金额从高到低")}</p>
                    </div>
                    <Link
                        to="/entries"
                        className="flex items-center gap-0.5 text-[10px] font-semibold text-accent hover:underline"
                    >{`${t("全部流水")} `}<ArrowUpRight className="size-3" />
                    </Link>
                </div>
                {topExpenses.length === 0 ? (
                    <p className="px-4 py-10 text-center text-xs text-muted">{t("这个月还没有支出")}</p>
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
                                            {entry.note || category?.name || t("支出")}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] text-muted">
                                            {category?.name ?? t("未分类")} ·{" "}
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
                            <MapPin className="size-4 text-muted" />{` ${t("消费足迹")}`}</h2>
                        <p className="mt-0.5 text-[11px] text-muted">{t("记录了位置的支出会出现在这里，点击地点切换地图。")}</p>
                    </div>
                    <span className="text-[10px] text-muted">
                        {locations.length}{` ${t("个地点")}`}</span>
                </div>

                {locations.length === 0 || !activeLocation ? (
                    <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-8 text-center text-[11px] leading-relaxed text-muted">{t("还没有带位置的支出。记账时点「获取当前位置」，就能在这里看到消费足迹。")}</p>
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
                                                {location.count}{` ${t("笔")}`}</span>
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
                                title={t("消费地点地图")}
                                src={mapUrl}
                                className="h-80 w-full"
                                loading="lazy"
                            />
                            <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/45 px-3 py-2 text-[10px] text-muted">
                                <span>
                                    {activeLocation.label || t("未命名地点")} ·{" "}
                                    {activeLocation.count}{` ${t("笔")}`}</span>
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${activeLocation.lat}&mlon=${activeLocation.lng}#map=16/${activeLocation.lat}/${activeLocation.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                                >{`${t("打开地图")} `}<ExternalLink className="size-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <p className="mt-5 flex items-center justify-center gap-1 text-[10px] text-muted">
                <ChartNoAxesColumn className="size-3" />{` ${t("统计口径：现金支出和赊账在记账时计入支出；还款只减少资产和负债；转账不计收支")}`}</p>

            <Modal
                open={saveOpen}
                onClose={() => setSaveOpen(false)}
                title={t("保存分析视图")}
                description={t("保存当前的分类、标签、账户、成员和关键词组合；时间维度继续使用上方月份。")}
                size="sm"
                footer={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setSaveOpen(false)}
                        >{t("取消")}</Button>
                        <Button
                            className="flex-1"
                            onClick={saveView}
                            disabled={!viewName.trim()}
                        >{t("保存")}</Button>
                    </div>
                }
            >
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("视图名称")}</span>
                    <input
                        className="field"
                        value={viewName}
                        onChange={(event) => setViewName(event.target.value)}
                        placeholder={t("例如：家庭餐饮、旅行支出、某成员账单")}
                        autoFocus
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                saveView();
                            }
                        }}
                    />
                </label>
            </Modal>

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
