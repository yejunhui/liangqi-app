/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    ArrowDownUp,
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Info,
    Mic,
    Plus,
    ReceiptText,
    Target,
    TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { EntryRow } from "@/components/entry-row";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { CategoryBars } from "@/components/category-bars";
import {
    getBillDueInfo,
    getBillRemaining,
    getBillStatus,
    getCategoryBreakdown,
    getMonthTotals,
    getOpenBills,
    getOutstandingTotal,
    getOverdueBills,
    getRecentDailyExpenses,
    getTotals,
} from "@/domain/ledger";
import { formatCents } from "@/domain/money";
import { getBudgetProgressList } from "@/domain/budgets";
import {
    formatMonthLabel,
    endOfMonth,
    isSameMonth,
    startOfMonth,
} from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { useUIStore } from "@/store/ui";
import { cn } from "@/utils/cn";

const dueToneClass = {
    neutral: "text-muted",
    warning: "text-liability",
    danger: "text-danger",
    success: "text-success",
};

export function Dashboard() {
    const accounts = useLedgerStore((state) => state.accounts);
    const entries = useLedgerStore((state) => state.entries);
    const bills = useLedgerStore((state) => state.bills);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tags = useLedgerStore((state) => state.tags);
    const budgets = useLedgerStore((state) => state.budgets);
    const currency = useCurrency();
    const openEntryModal = useUIStore((state) => state.openEntryModal);
    const openQuickEntry = useUIStore((state) => state.openQuickEntry);
    const [month, setMonth] = useState(() => startOfMonth(Date.now()));
    const [now] = useState(() => Date.now());

    const totals = useMemo(() => getTotals({ accounts, entries }), [accounts, entries]);
    const monthTotals = useMemo(() => getMonthTotals(entries, month), [entries, month]);
    const breakdown = useMemo(
        () => getCategoryBreakdown(entries, categories, month),
        [entries, categories, month],
    );
    const openBills = useMemo(() => getOpenBills(bills, entries), [bills, entries]);
    const outstanding = useMemo(() => getOutstandingTotal(bills, entries), [bills, entries]);
    const overdueBills = useMemo(() => getOverdueBills(bills, entries, now), [bills, entries, now]);
    const overdueTotal = useMemo(
        () => overdueBills.reduce((sum, bill) => sum + getBillRemaining(bill, entries), 0),
        [overdueBills, entries],
    );
    const recent = useMemo(
        () =>
            [...entries]
                .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)
                .slice(0, 6),
        [entries],
    );
    const daily = useMemo(() => {
        const chartEnd = isSameMonth(month, now) ? now : endOfMonth(month);
        return getRecentDailyExpenses(entries, 7, chartEnd);
    }, [entries, month, now]);
    const budgetProgress = useMemo(
        () => getBudgetProgressList(budgets, entries, categories, now).slice(0, 3),
        [budgets, entries, categories, now],
    );

    const canGoNext = !isSameMonth(month, now);

    function shiftMonth(delta: number) {
        setMonth((current) => {
            const next = new Date(current);
            next.setMonth(next.getMonth() + delta);
            return startOfMonth(next.getTime());
        });
    }

    return (
        <div>
            <PageHeader
                eyebrow="总览"
                title="把两边的账，记清楚。"
                description="现金支出直接扣存款；赊账先记负债，之后还款。左边右边都算清楚。"
                action={
                    <>
                        <SyncStatusBadge />
                        <Button onClick={() => openEntryModal()}>
                            <Plus className="size-4" />
                            记一笔
                        </Button>
                    </>
                }
            />

            <section className="relative overflow-hidden rounded-[1.75rem] bg-[#123b36] p-6 text-[#f7f2e8] shadow-xl sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[#5eead4]/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-[#fbbf24]/10 blur-3xl" />
                <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold tracking-[0.14em] text-[#f7f2e8]/65">
                            净资产
                        </p>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70">
                            实时资产
                        </span>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                        {formatCents(totals.netWorth, currency)}
                    </p>
                    <p className="mt-1.5 text-[11px] text-white/55">
                        资产减去负债，才是真正属于你的钱
                    </p>

                    <div className="mt-6 grid max-w-lg grid-cols-3 gap-3">
                        <div>
                            <p className="text-[10px] font-medium tracking-wide text-white/50">
                                总资产
                            </p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-white/95 sm:text-lg">
                                {formatCents(totals.assets, currency)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-medium tracking-wide text-white/50">
                                总负债
                            </p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-[#fbbf24] sm:text-lg">
                                {formatCents(totals.liabilities, currency)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-medium tracking-wide text-white/50">
                                可支配
                            </p>
                            <p
                                className={cn(
                                    "mt-1 text-base font-semibold tabular-nums sm:text-lg",
                                    totals.disposable < 0
                                        ? "text-[#fca5a5]"
                                        : "text-[#5eead4]",
                                )}
                            >
                                {formatCents(totals.disposable, currency)}
                            </p>
                            <p className="mt-0.5 text-[9px] text-white/40">
                                流动资产 − 负债
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <QuickAction
                            icon={ReceiptText}
                            label="记支出"
                            hint="现在扣存款"
                            onClick={() => openEntryModal({ kind: "expense", paymentMode: "asset" })}
                        />
                        <QuickAction
                            icon={CreditCard}
                            label="记赊账"
                            hint="先记负债"
                            onClick={() =>
                                openEntryModal({ kind: "expense", paymentMode: "liability" })
                            }
                        />
                        <QuickAction
                            icon={ArrowDownUp}
                            label="记收入"
                            hint="存款增加"
                            onClick={() => openEntryModal({ kind: "income" })}
                        />
                        <QuickAction
                            icon={Mic}
                            label="智能记账"
                            hint="说一句就记"
                            onClick={() => openQuickEntry()}
                        />
                    </div>
                </div>
            </section>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label="本月支出"
                    value={monthTotals.expense}
                    currency={currency}
                    hint="含赊账，不含还款"
                    tone="liability"
                    icon={ReceiptText}
                />
                <StatCard
                    label="本月收入"
                    value={monthTotals.income}
                    currency={currency}
                    hint={`结余 ${formatCents(monthTotals.net, currency)}`}
                    tone="success"
                    icon={TrendingUp}
                />
                <StatCard
                    label="待还账单"
                    value={outstanding}
                    currency={currency}
                    hint={openBills.length > 0 ? `${openBills.length} 笔未结清` : "没有待还账单"}
                    tone="liability"
                    icon={CreditCard}
                />
                <StatCard
                    label="逾期未还"
                    value={overdueTotal}
                    currency={currency}
                    hint={overdueBills.length > 0 ? `${overdueBills.length} 笔已逾期` : "没有逾期"}
                    tone={overdueBills.length > 0 ? "danger" : "muted"}
                    icon={AlertTriangle}
                />
            </div>

            {budgetProgress.length > 0 && (
                <section className="card mt-4 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-text">预算进度</h2>
                            <p className="mt-0.5 text-[11px] text-muted">
                                按当前月度 / 年度统计
                            </p>
                        </div>
                        <Link
                            to="/budgets"
                            className="flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
                        >
                            全部预算
                            <ArrowUpRight className="size-3" />
                        </Link>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        {budgetProgress.map(({ budget, spent, remaining, progress }) => {
                            const over = spent > budget.amount;
                            return (
                                <Link
                                    key={budget.id}
                                    to="/budgets"
                                    className="rounded-xl border border-line bg-surface-2/40 p-3 transition hover:border-line-strong"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-xs font-semibold text-text">
                                            {budget.name}
                                        </p>
                                        <Target
                                            className={cn(
                                                "size-3.5 shrink-0",
                                                over ? "text-danger" : "text-accent",
                                            )}
                                        />
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                                        <div
                                            className={cn(
                                                "h-full rounded-full",
                                                over ? "bg-danger" : "bg-accent",
                                            )}
                                            style={{
                                                width: `${Math.max(
                                                    2,
                                                    Math.min(100, progress * 100),
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-muted">
                                        <span className={over ? "text-danger" : "text-text"}>
                                            {formatCents(spent, currency)}
                                        </span>{" "}
                                        / {formatCents(budget.amount, currency)}
                                        {over
                                            ? ` · 超 ${formatCents(-remaining, currency)}`
                                            : ""}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <section className="card p-5 lg:col-span-2">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-text">本月支出</h2>
                            <p className="mt-0.5 text-[11px] text-muted">
                                赊账在消费时计入，还款时不再重复计入
                            </p>
                        </div>
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
                    </div>

                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-3xl font-bold tracking-tight tabular-nums text-text">
                                {formatCents(monthTotals.expense, currency)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                                收入 {formatCents(monthTotals.income, currency)} · 结余{" "}
                                <span
                                    className={cn(
                                        "font-semibold",
                                        monthTotals.net >= 0 ? "text-success" : "text-danger",
                                    )}
                                >
                                    {formatCents(monthTotals.net, currency)}
                                </span>
                            </p>
                        </div>
                        <div className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[10px] text-muted">
                            还款 {formatCents(monthTotals.repayment, currency)}（不计支出）
                        </div>
                    </div>

                    <div className="mt-5 grid gap-6 sm:grid-cols-2">
                        <MiniBarChart data={daily} currency={currency} />
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-text">分类占比</h3>
                                <span className="text-[10px] text-muted">
                                    {breakdown.length} 个分类
                                </span>
                            </div>
                            <CategoryBars items={breakdown} currency={currency} limit={5} />
                        </div>
                    </div>
                </section>

                <section className="card flex flex-col p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-text">待还账单</h2>
                            <p className="mt-0.5 text-[11px] text-muted">
                                按到期日排序
                            </p>
                        </div>
                        <Link
                            to="/bills"
                            className="flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
                        >
                            全部
                            <ArrowUpRight className="size-3" />
                        </Link>
                    </div>

                    {openBills.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                            <span className="grid size-11 place-items-center rounded-2xl bg-success-soft text-success">
                                <CreditCard className="size-5" />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-text">没有待还账单</p>
                            <p className="mt-1 text-xs text-muted">赊账消费会自动生成账单</p>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="mt-4"
                                onClick={() =>
                                    openEntryModal({ kind: "expense", paymentMode: "liability" })
                                }
                            >
                                <Plus className="size-3.5" />
                                记一笔赊账
                            </Button>
                        </div>
                    ) : (
                        <div className="mt-3 flex-1 space-y-2">
                            {openBills.slice(0, 4).map((bill) => {
                                const status = getBillStatus(bill, entries);
                                const due = getBillDueInfo(bill, status, now);
                                const category = categories.find(
                                    (item) => item.id === bill.categoryId,
                                );
                                return (
                                    <Link
                                        key={bill.id}
                                        to="/bills"
                                        className="flex items-center gap-2.5 rounded-xl px-1 py-2 transition hover:bg-surface-2/70"
                                    >
                                        <span
                                            className="grid size-8 shrink-0 place-items-center rounded-lg text-sm"
                                            style={{
                                                backgroundColor: `${category?.color ?? "#a8a29e"}20`,
                                            }}
                                        >
                                            {category?.emoji ?? "🧾"}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-semibold text-text">
                                                {bill.title}
                                            </span>
                                            <span
                                                className={cn(
                                                    "mt-0.5 block text-[10px]",
                                                    dueToneClass[due.tone],
                                                )}
                                            >
                                                {due.label}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs font-bold tabular-nums text-liability">
                                            {formatCents(getBillRemaining(bill, entries), currency)}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            <section className="card mt-4 p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-text">最近流水</h2>
                        <p className="mt-0.5 text-[11px] text-muted">收入、支出和还款都在这里</p>
                    </div>
                    <Link
                        to="/entries"
                        className="flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
                    >
                        全部流水
                        <ArrowUpRight className="size-3" />
                    </Link>
                </div>

                {recent.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-2/40 px-5 py-8 text-center">
                        <p className="text-sm font-semibold text-text">账本还是空的</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                            先记一笔支出：现在扣存款，或者先记负债之后还。
                        </p>
                        <Button size="sm" className="mt-4" onClick={() => openEntryModal()}>
                            <Plus className="size-3.5" />
                            记第一笔
                        </Button>
                    </div>
                ) : (
                    <div className="mt-2 -mx-2 divide-y divide-line/60">
                        {recent.map((entry) => (
                            <EntryRow
                                key={entry.id}
                                entry={entry}
                                accounts={accounts}
                                bills={bills}
                                categories={categories}
                                members={members}
                                tags={tags}
                                currency={currency}
                            />
                        ))}
                    </div>
                )}
            </section>

            <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-surface/60 p-4">
                <Info className="mt-0.5 size-4 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-muted">
                    <strong className="font-semibold text-text">账务规则：</strong>
                    赊账消费计入本月支出，同时增加负债，但不动存款；还款只减少存款和负债，不再计入支出。这样既能看到真实消费，也不会重复统计。
                </p>
            </div>
        </div>
    );
}

function QuickAction({
    icon: Icon,
    label,
    hint,
    onClick,
}: {
    icon: typeof ReceiptText;
    label: string;
    hint: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/10"
        >
            <Icon className="size-3.5 text-[#5eead4]" />
            <span>
                <span className="block text-[11px] font-semibold text-white/90">{label}</span>
                <span className="block text-[9px] text-white/45">{hint}</span>
            </span>
        </button>
    );
}

function StatCard({
    label,
    value,
    currency,
    hint,
    tone,
    icon: Icon,
}: {
    label: string;
    value: number;
    currency: string;
    hint: string;
    tone: "liability" | "success" | "danger" | "muted";
    icon: typeof ReceiptText;
}) {
    const toneClass = {
        liability: "bg-liability-soft text-liability",
        success: "bg-success-soft text-success",
        danger: "bg-danger-soft text-danger",
        muted: "bg-surface-2 text-muted",
    }[tone];
    const valueClass = {
        liability: "text-text",
        success: "text-text",
        danger: "text-danger",
        muted: "text-text",
    }[tone];

    return (
        <div className="card p-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted">{label}</p>
                <span className={cn("grid size-7 place-items-center rounded-lg", toneClass)}>
                    <Icon className="size-3.5" />
                </span>
            </div>
            <p
                className={cn(
                    "mt-2 text-lg font-bold tracking-tight tabular-nums",
                    valueClass,
                )}
            >
                {formatCents(value, currency)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
        </div>
    );
}
