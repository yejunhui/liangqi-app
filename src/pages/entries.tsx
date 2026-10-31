/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Plus, ReceiptText, Search, X } from "lucide-react";
import type { Entry, EntryKind } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { Tabs, type TabItem } from "@/components/tabs";
import { EntryRow } from "@/components/entry-row";
import { EntryDetailModal } from "@/components/entry-detail-modal";
import { EmptyState } from "@/components/empty-state";
import { formatCents } from "@/domain/money";
import { formatDate, formatRelativeDay, formatWeekday, startOfDay } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { useUIStore } from "@/store/ui";

type Filter = "all" | EntryKind;

export function Entries() {
    const accounts = useLedgerStore((state) => state.accounts);
    const entries = useLedgerStore((state) => state.entries);
    const bills = useLedgerStore((state) => state.bills);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const currency = useCurrency();
    const openEntryModal = useUIStore((state) => state.openEntryModal);

    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

    const counts = useMemo(() => {
        return {
            all: entries.length,
            expense: entries.filter((entry) => entry.kind === "expense").length,
            income: entries.filter((entry) => entry.kind === "income").length,
            repayment: entries.filter((entry) => entry.kind === "repayment").length,
        };
    }, [entries]);

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return entries
            .filter((entry) => filter === "all" || entry.kind === filter)
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
                const haystack = [
                    entry.note,
                    category?.name,
                    bill?.title,
                    asset?.name,
                    liability?.name,
                    member?.name,
                    (entry.amount / 100).toFixed(2),
                    entry.kind === "expense" ? "支出" : entry.kind === "income" ? "收入" : "还款",
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(keyword);
            })
            .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
    }, [entries, filter, query, categories, bills, accounts, members]);

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
        { value: "all", label: "全部", count: counts.all },
        { value: "expense", label: "支出", count: counts.expense },
        { value: "income", label: "收入", count: counts.income },
        { value: "repayment", label: "还款", count: counts.repayment },
    ];

    const hasFilter = filter !== "all" || query.trim() !== "";

    return (
        <div>
            <PageHeader
                title="流水"
                description="每一笔支出、收入和还款都在这里。点开可以查看详情或删除。"
                action={
                    <Button onClick={() => openEntryModal()}>
                        <Plus className="size-4" />
                        记一笔
                    </Button>
                }
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs items={tabs} value={filter} onChange={setFilter} />
                <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索备注、分类、账户"
                        aria-label="搜索流水"
                        className="field py-2 pl-9 pr-9 text-xs"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted transition hover:text-text"
                            aria-label="清空搜索"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="card overflow-hidden">
                {groups.length === 0 ? (
                    <EmptyState
                        icon={ReceiptText}
                        title={hasFilter ? "没有找到流水" : "还没有流水"}
                        description={
                            hasFilter
                                ? "换个筛选条件，或者清空搜索再看看。"
                                : "先记一笔：现金支出、赊账或者收入都可以。"
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
                                    }}
                                >
                                    清空筛选
                                </Button>
                            ) : (
                                <Button size="sm" onClick={() => openEntryModal()}>
                                    <Plus className="size-3.5" />
                                    记一笔
                                </Button>
                            )
                        }
                    />
                ) : (
                    groups.map(([day, dayEntries]) => {
                        const expense = dayEntries
                            .filter((entry) => entry.kind === "expense")
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
                                            <span>支出 {formatCents(expense, currency)}</span>
                                        )}
                                        {income > 0 && (
                                            <span className="text-success">
                                                收入 {formatCents(income, currency)}
                                            </span>
                                        )}
                                        {repayment > 0 && (
                                            <span>还款 {formatCents(repayment, currency)}</span>
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
                                            currency={currency}
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
        </div>
    );
}
