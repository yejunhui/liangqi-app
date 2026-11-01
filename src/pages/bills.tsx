/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { CreditCard, Plus, ShieldCheck } from "lucide-react";
import type { Bill } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { Tabs, type TabItem } from "@/components/tabs";
import { BillCard } from "@/components/bill-card";
import { EditBillModal } from "@/components/edit-bill-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import {
    getBillStatus,
    getMonthTotals,
    getOpenBills,
    getOutstandingTotal,
    getOverdueBills,
} from "@/domain/ledger";
import { formatCents } from "@/domain/money";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { useActiveMember } from "@/store/member-session";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";

type Filter = "open" | "paid" | "all";

export function Bills() {
    const bills = useLedgerStore((state) => state.bills);
    const entries = useLedgerStore((state) => state.entries);
    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tags = useLedgerStore((state) => state.tags);
    const deleteBill = useLedgerStore((state) => state.deleteBill);
    const currency = useCurrency();
    const activeMember = useActiveMember();
    const remote = useLedgerStore((state) => state.remote);
    const openEntryModal = useUIStore((state) => state.openEntryModal);

    const [filter, setFilter] = useState<Filter>("open");
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
    const [now] = useState(() => Date.now());

    const openBills = useMemo(() => getOpenBills(bills, entries), [bills, entries]);
    const paidBills = useMemo(
        () =>
            bills
                .filter((bill) => getBillStatus(bill, entries) === "paid")
                .sort((a, b) => b.purchasedAt - a.purchasedAt),
        [bills, entries],
    );
    const outstanding = useMemo(() => getOutstandingTotal(bills, entries), [bills, entries]);
    const overdue = useMemo(() => getOverdueBills(bills, entries, now), [bills, entries, now]);
    const monthRepayment = useMemo(
        () => getMonthTotals(entries, now).repayment,
        [entries, now],
    );
    const totalRepaid = useMemo(
        () =>
            entries
                .filter((entry) => entry.kind === "repayment")
                .reduce((sum, entry) => sum + entry.amount, 0),
        [entries],
    );
    const totalPrincipal = useMemo(
        () => bills.reduce((sum, bill) => sum + bill.principal, 0),
        [bills],
    );
    const repaidProgress = totalPrincipal > 0 ? totalRepaid / totalPrincipal : 0;

    const visibleBills =
        filter === "open" ? openBills : filter === "paid" ? paidBills : [...openBills, ...paidBills];

    const tabs: TabItem<Filter>[] = [
        { value: "open", label: "待还", count: openBills.length },
        { value: "paid", label: "已还清", count: paidBills.length },
        { value: "all", label: "全部", count: bills.length },
    ];

    function handleDelete() {
        if (!deletingBill) {
            return;
        }
        const result = deleteBill(deletingBill.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast("账单已删除", "success");
        setDeletingBill(null);
    }

    return (
        <div>
            <PageHeader
                title="账单"
                description="赊账消费会生成待还账单；还款后自动更新进度，并按还款金额计入支出。"
                action={
                    <Button
                        onClick={() =>
                            openEntryModal({ kind: "expense", paymentMode: "liability" })
                        }
                    >
                        <Plus className="size-4" />
                        记一笔赊账
                    </Button>
                }
            />

            <section className="card overflow-hidden">
                <div className="grid gap-5 p-5 sm:grid-cols-[1.4fr_1fr] sm:p-6">
                    <div>
                        <p className="text-[11px] font-medium text-muted">待还总额</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-liability">
                            {formatCents(outstanding, currency)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                            <span>{openBills.length} 笔未结清</span>
                            <span className="text-line-strong">·</span>
                            <span className={overdue.length > 0 ? "text-danger" : ""}>
                                {overdue.length > 0
                                    ? `${overdue.length} 笔逾期`
                                    : "没有逾期账单"}
                            </span>
                        </div>

                        <div className="mt-5 max-w-md">
                            <div className="flex items-center justify-between text-[10px] text-muted">
                                <span>累计还款进度</span>
                                <span className="tabular-nums">
                                    {formatCents(totalRepaid, currency)} /{" "}
                                    {formatCents(totalPrincipal, currency)}
                                </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                                <div
                                    className="h-full rounded-full bg-accent"
                                    style={{ width: `${Math.min(100, Math.max(1, repaidProgress * 100))}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                        <div className="rounded-xl border border-line bg-surface-2/55 p-3">
                            <p className="text-[10px] text-muted">本月已还（计入支出）</p>
                            <p className="mt-1 text-base font-bold tabular-nums text-text">
                                {formatCents(monthRepayment, currency)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-line bg-surface-2/55 p-3">
                            <p className="text-[10px] text-muted">累计已还</p>
                            <p className="mt-1 text-base font-bold tabular-nums text-text">
                                {formatCents(totalRepaid, currency)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 border-t border-line bg-accent-soft/35 px-5 py-2.5 text-[10px] text-muted sm:px-6">
                    <ShieldCheck className="size-3.5 text-accent" />
                    还款是“存款 → 负债”的转移，并在还款时计入支出。
                </div>
            </section>

            <div className="mt-5 flex items-center justify-between gap-3">
                <Tabs items={tabs} value={filter} onChange={setFilter} />
                <p className="hidden text-[11px] text-muted sm:block">
                    共 {visibleBills.length} 笔
                </p>
            </div>

            {visibleBills.length === 0 ? (
                <EmptyState
                    icon={CreditCard}
                    title={
                        filter === "paid"
                            ? "还没有还清的账单"
                            : filter === "open"
                              ? "没有待还账单"
                              : "还没有账单"
                    }
                    description={
                        filter === "paid"
                            ? "完成一次还款后，账单会出现在这里。"
                            : "赊账消费不会动存款，会先生成一张待还账单。"
                    }
                    className="mt-4"
                    action={
                        filter !== "paid" ? (
                            <Button
                                size="sm"
                                onClick={() =>
                                    openEntryModal({
                                        kind: "expense",
                                        paymentMode: "liability",
                                    })
                                }
                            >
                                <Plus className="size-3.5" />
                                记一笔赊账
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {visibleBills.map((bill) => (
                        <BillCard
                            key={bill.id}
                            bill={bill}
                            entries={entries}
                            accounts={accounts}
                            categories={categories}
                            members={members}
                            tags={tags}
                            currency={currency}
                            canEdit={
                                !remote ||
                                Boolean(activeMember) &&
                                    (!bill.ownerId || bill.ownerId === activeMember?.id)
                            }
                            onRepay={() =>
                                openEntryModal({ kind: "repayment", billId: bill.id })
                            }
                            onEdit={() => setEditingBill(bill)}
                            onDelete={() => setDeletingBill(bill)}
                        />
                    ))}
                </div>
            )}

            <EditBillModal bill={editingBill} onClose={() => setEditingBill(null)} />

            <ConfirmDialog
                open={deletingBill !== null}
                onClose={() => setDeletingBill(null)}
                title="删除这张账单？"
                description={
                    deletingBill
                        ? `“${deletingBill.title}”对应的赊账流水也会一起删除。已有还款的账单不能删除。`
                        : ""
                }
                confirmLabel="删除"
                onConfirm={handleDelete}
            />

            <p className="mt-5 text-center text-[10px] text-muted">
                待还金额合计 {formatCents(outstanding, currency)} · 数据只保存在本机浏览器
            </p>
        </div>
    );
}
