/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import {
    ListChecks,
    Plus,
    ReceiptText,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import type { Entry, EntryKind } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { Tabs, type TabItem } from "@/components/tabs";
import { EntryRow } from "@/components/entry-row";
import { EntryDetailModal } from "@/components/entry-detail-modal";
import { BatchEditModal } from "@/components/batch-edit-modal";
import { EmptyState } from "@/components/empty-state";
import { formatCents, parseAmountToCents } from "@/domain/money";
import { isRecognizedExpense } from "@/domain/ledger";
import { matchesEntryFilter, type EntryFilter } from "@/domain/filters";
import {
    endOfDay,
    formatDate,
    formatRelativeDay,
    formatWeekday,
    fromDateInputValue,
    startOfDay,
} from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { useActiveMember } from "@/store/member-session";
import { useUIStore } from "@/store/ui";

import { t } from "@/i18n";

type Filter = "all" | EntryKind;

interface AdvancedFilterState {
    start: string;
    end: string;
    categoryId: string;
    memberId: string;
    accountId: string;
    tagId: string;
    minAmount: string;
    maxAmount: string;
}

const EMPTY_ADVANCED: AdvancedFilterState = {
    start: "",
    end: "",
    categoryId: "",
    memberId: "",
    accountId: "",
    tagId: "",
    minAmount: "",
    maxAmount: "",
};

export function Entries() {
    const accounts = useLedgerStore((state) => state.accounts);
    const entries = useLedgerStore((state) => state.entries);
    const bills = useLedgerStore((state) => state.bills);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tags = useLedgerStore((state) => state.tags);
    const currency = useCurrency();
    const activeMember = useActiveMember();
    const remote = useLedgerStore((state) => state.remote);
    const openEntryModal = useUIStore((state) => state.openEntryModal);

    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [advanced, setAdvanced] = useState<AdvancedFilterState>(EMPTY_ADVANCED);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchOpen, setBatchOpen] = useState(false);

    const counts = useMemo(() => {
        return {
            all: entries.length,
            expense: entries.filter((entry) => entry.kind === "expense").length,
            income: entries.filter((entry) => entry.kind === "income").length,
            repayment: entries.filter((entry) => entry.kind === "repayment").length,
            transfer: entries.filter((entry) => entry.kind === "transfer").length,
        };
    }, [entries]);

    const advancedFilter = useMemo<EntryFilter>(() => {
        const start = advanced.start ? fromDateInputValue(advanced.start) : null;
        const end = advanced.end ? fromDateInputValue(advanced.end) : null;
        return {
            categoryId: advanced.categoryId || undefined,
            memberId: advanced.memberId || undefined,
            accountId: advanced.accountId || undefined,
            tagId: advanced.tagId || undefined,
            start: start !== null ? startOfDay(start) : undefined,
            end: end !== null ? endOfDay(end) : undefined,
            minAmount: advanced.minAmount
                ? parseAmountToCents(advanced.minAmount) ?? undefined
                : undefined,
            maxAmount: advanced.maxAmount
                ? parseAmountToCents(advanced.maxAmount) ?? undefined
                : undefined,
        };
    }, [advanced]);
    const activeFilterCount = Object.values(advanced).filter(
        (value) => value.trim() !== "",
    ).length;

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return entries
            .filter((entry) => filter === "all" || entry.kind === filter)
            .filter((entry) => matchesEntryFilter(entry, advancedFilter, categories))
            .filter((entry) => {
                if (!keyword) {
                    return true;
                }
                const category = categories.find((item) => item.id === entry.categoryId);
                const bill = bills.find((item) => item.id === entry.billId);
                const asset = accounts.find((item) => item.id === entry.accountId);
                const liability = accounts.find(
                    (item) => item.id === entry.liabilityAccountId,
                );
                const member = members.find((item) => item.id === entry.memberId);
                const entryTags = (entry.tagIds ?? [])
                    .map((tagId) => tags.find((item) => item.id === tagId)?.name)
                    .filter(Boolean);
                const parentCategory = category?.parent
                    ? categories.find((item) => item.id === category.parent)
                    : undefined;
                const haystack = [
                    entry.note,
                    category?.name,
                    parentCategory?.name,
                    bill?.title,
                    asset?.name,
                    liability?.name,
                    member?.name,
                    entry.ownerName,
                    ...entryTags,
                    (entry.amount / 100).toFixed(2),
                    entry.kind === "expense"
                        ? entry.billId
                            ? t("赊账 支出")
                            : t("支出")
                        : entry.kind === "income"
                          ? t("收入")
                          : entry.kind === "transfer"
                            ? t("转账")
                            : t("还款"),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(keyword);
            })
            .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
    }, [entries, filter, query, categories, bills, accounts, members, tags, advancedFilter]);

    const groups = useMemo(() => {
        const map = new Map<number, Entry[]>();
        for (const entry of filtered) {
            const key = startOfDay(entry.date);
            const list = map.get(key);
            if (list) {
                list.push(entry);
            } else {
                map.set(key, [entry]);
            }
        }
        return [...map.entries()].sort((a, b) => b[0] - a[0]);
    }, [filtered]);

    const tabs: TabItem<Filter>[] = [
        { value: "all", label: t("全部"), count: counts.all },
        { value: "expense", label: t("支出"), count: counts.expense },
        { value: "income", label: t("收入"), count: counts.income },
        { value: "repayment", label: t("还款"), count: counts.repayment },
        { value: "transfer", label: t("转账"), count: counts.transfer },
    ];

    const hasFilter =
        filter !== "all" || query.trim() !== "" || activeFilterCount > 0;
    const selectedEntries = useMemo(
        () => entries.filter((entry) => selectedIds.has(entry.id)),
        [entries, selectedIds],
    );
    const selectableVisible = useMemo(
        () =>
            filtered.filter(
                (entry) =>
                    !remote ||
                    (activeMember &&
                        (!entry.ownerId || entry.ownerId === activeMember.id)),
            ),
        [filtered, activeMember, remote],
    );

    function toggleSelection(entryId: string) {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(entryId)) {
                next.delete(entryId);
            } else {
                next.add(entryId);
            }
            return next;
        });
    }

    function toggleSelectMode() {
        setSelectMode((current) => {
            if (current) {
                setSelectedIds(new Set());
            }
            return !current;
        });
    }

    function selectVisible() {
        const selectable = filtered.filter(
            (entry) =>
                !remote ||
                (activeMember &&
                    (!entry.ownerId || entry.ownerId === activeMember.id)),
        );
        setSelectedIds((current) => {
            const next = new Set(current);
            const allSelected =
                selectable.length > 0 &&
                selectable.every((entry) => next.has(entry.id));
            if (allSelected) {
                for (const entry of selectable) {
                    next.delete(entry.id);
                }
            } else {
                for (const entry of selectable) {
                    next.add(entry.id);
                }
            }
            return next;
        });
    }

    return (
        <div>
            <PageHeader
                title={t("流水")}
                description={t("每一笔支出、收入和还款都在这里。点开可以查看详情或删除。")}
                action={
                    <div className="flex gap-2">
                        <Button
                            variant={selectMode ? "primary" : "secondary"}
                            onClick={toggleSelectMode}
                        >
                            <ListChecks className="size-4" />
                            {selectMode ? t("完成") : t("批量")}
                        </Button>
                        <Button onClick={() => openEntryModal()}>
                            <Plus className="size-4" />{` ${t("记一笔")}`}</Button>
                    </div>
                }
            />

            <div className="mb-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Tabs items={tabs} value={filter} onChange={setFilter} />
                    <div className="flex w-full gap-2 sm:w-auto">
                        <div className="relative min-w-0 flex-1 sm:w-72">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t("搜索备注、分类、账户")}
                                aria-label={t("搜索流水")}
                                className="field py-2 pl-9 pr-9 text-xs"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery("")}
                                    className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted transition hover:text-text"
                                    aria-label={t("清空搜索")}
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                        <Button
                            variant={filterOpen || activeFilterCount > 0 ? "primary" : "secondary"}
                            onClick={() => setFilterOpen((current) => !current)}
                            className="shrink-0"
                        >
                            <SlidersHorizontal className="size-4" />{` ${t("筛选")} `}{activeFilterCount > 0 && (
                                <span className="rounded-full bg-surface/25 px-1.5 text-[10px]">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {filterOpen && (
                    <div className="card p-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("开始日期")}</span>
                                <input
                                    type="date"
                                    className="field py-2 text-xs"
                                    value={advanced.start}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            start: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("结束日期")}</span>
                                <input
                                    type="date"
                                    className="field py-2 text-xs"
                                    value={advanced.end}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            end: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("分类")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={advanced.categoryId}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            categoryId: event.target.value,
                                        }))
                                    }
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
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("成员")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={advanced.memberId}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            memberId: event.target.value,
                                        }))
                                    }
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
                                    value={advanced.accountId}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            accountId: event.target.value,
                                        }))
                                    }
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
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("标签")}</span>
                                <select
                                    className="field py-2 text-xs"
                                    value={advanced.tagId}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            tagId: event.target.value,
                                        }))
                                    }
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
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("最小金额")}</span>
                                <input
                                    className="field py-2 text-xs"
                                    inputMode="decimal"
                                    value={advanced.minAmount}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            minAmount: event.target.value,
                                        }))
                                    }
                                    placeholder="0.00"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("最大金额")}</span>
                                <input
                                    className="field py-2 text-xs"
                                    inputMode="decimal"
                                    value={advanced.maxAmount}
                                    onChange={(event) =>
                                        setAdvanced((current) => ({
                                            ...current,
                                            maxAmount: event.target.value,
                                        }))
                                    }
                                    placeholder={t("不限")}
                                />
                            </label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] text-muted">{t("筛选会和上方类型、搜索关键词同时生效。")}</p>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setAdvanced(EMPTY_ADVANCED)}
                                disabled={activeFilterCount === 0}
                            >{t("清空条件")}</Button>
                        </div>
                    </div>
                )}
            </div>

            {selectMode && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/20 bg-accent-soft/45 px-3 py-2.5">
                    <p className="text-xs font-semibold text-accent">{`${t("已选")} `}{selectedIds.size}{` ${t("笔")} `}<span className="ml-2 font-normal text-muted">{t("只能选择自己记的账")}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={selectVisible}>
                            {selectableVisible.length > 0 &&
                            selectableVisible.every((entry) => selectedIds.has(entry.id))
                                ? t("取消全选")
                                : t("全选当前")}
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setBatchOpen(true)}
                            disabled={selectedIds.size === 0}
                        >{t("修改选中")}</Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >{t("清空")}</Button>
                    </div>
                </div>
            )}

            <div className="card overflow-hidden">
                {groups.length === 0 ? (
                    <EmptyState
                        icon={ReceiptText}
                        title={hasFilter ? t("没有找到流水") : t("还没有流水")}
                        description={
                            hasFilter
                                ? t("换个筛选条件，或者清空搜索再看看。")
                                : t("先记一笔：现金支出、赊账或者收入都可以。")
                        }
                        className="border-0 bg-transparent"
                        action={
                            hasFilter ? (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setFilter("all");
                                        setQuery("");
                                        setAdvanced(EMPTY_ADVANCED);
                                    }}
                                >{t("清空筛选")}</Button>
                            ) : (
                                <Button size="sm" onClick={() => openEntryModal()}>
                                    <Plus className="size-3.5" />{` ${t("记一笔")}`}</Button>
                            )
                        }
                    />
                ) : (
                    groups.map(([day, dayEntries]) => {
                        const expense = dayEntries
                            .filter(isRecognizedExpense)
                            .reduce((sum, entry) => sum + entry.amount, 0);
                        const income = dayEntries
                            .filter((entry) => entry.kind === "income")
                            .reduce((sum, entry) => sum + entry.amount, 0);
                        const repayment = dayEntries
                            .filter((entry) => entry.kind === "repayment")
                            .reduce((sum, entry) => sum + entry.amount, 0);
                        const relative = formatRelativeDay(day);
                        const absolute = formatDate(day);
                        const showAbsolute = relative !== absolute;

                        return (
                            <section key={day}>
                                <div className="flex items-center justify-between gap-2 border-y border-line bg-surface-2/45 px-4 py-2 first:border-t-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-bold text-text">
                                            {relative}
                                        </span>
                                        <span className="text-[10px] text-muted">
                                            {showAbsolute
                                                ? `${absolute} · ${formatWeekday(day)}`
                                                : formatWeekday(day)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted">
                                        {expense > 0 && (
                                            <span>{`${t("支出")} `}{formatCents(expense, currency)}
                                                {repayment > 0
                                                    ? t("（含还款 {0}）", [formatCents(
                                                          repayment,
                                                          currency,
                                                      )])
                                                    : ""}
                                            </span>
                                        )}
                                        {income > 0 && (
                                            <span className="text-success">{`${t("收入")} `}{formatCents(income, currency)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="divide-y divide-line/60 px-2">
                                    {dayEntries.map((entry) => (
                                        <EntryRow
                                            key={entry.id}
                                            entry={entry}
                                            accounts={accounts}
                                            bills={bills}
                                            categories={categories}
                                            members={members}
                                            tags={tags}
                                            currency={currency}
                                            selectable={
                                                selectMode &&
                                                (!remote ||
                                                    (activeMember &&
                                                        (!entry.ownerId ||
                                                            entry.ownerId ===
                                                                activeMember.id)))
                                            }
                                            selected={selectedIds.has(entry.id)}
                                            onToggle={() => toggleSelection(entry.id)}
                                            onClick={() => setSelectedEntry(entry)}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}
            </div>

            <EntryDetailModal
                entry={selectedEntry}
                onClose={() => setSelectedEntry(null)}
            />

            <BatchEditModal
                open={batchOpen}
                entries={selectedEntries}
                onClose={() => setBatchOpen(false)}
            />
        </div>
    );
}
