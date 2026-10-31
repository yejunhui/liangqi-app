/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState, type ReactNode } from "react";
import { CreditCard, Trash2, Wallet } from "lucide-react";
import type { Entry } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Money } from "@/components/money";
import { formatCents } from "@/domain/money";
import {
    getBillDueInfo,
    getBillRemaining,
    getBillStatus,
} from "@/domain/ledger";
import { formatDateFull } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

interface EntryDetailModalProps {
    entry: Entry | null;
    onClose: () => void;
}

export function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
    const accounts = useLedgerStore((state) => state.accounts);
    const bills = useLedgerStore((state) => state.bills);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const entries = useLedgerStore((state) => state.entries);
    const deleteEntry = useLedgerStore((state) => state.deleteEntry);
    const currency = useCurrency();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const bill = entry?.billId ? bills.find((item) => item.id === entry.billId) : undefined;
    const category = entry?.categoryId
        ? categories.find((item) => item.id === entry.categoryId)
        : undefined;
    const asset = entry?.accountId
        ? accounts.find((item) => item.id === entry.accountId)
        : undefined;
    const liability = entry?.liabilityAccountId
        ? accounts.find((item) => item.id === entry.liabilityAccountId)
        : undefined;
    const member = entry?.memberId
        ? members.find((item) => item.id === entry.memberId)
        : undefined;

    const kindLabel =
        entry?.kind === "expense" ? "支出" : entry?.kind === "income" ? "收入" : "还款";
    const sign = entry?.kind === "income" ? "positive" : "negative";

    function handleDelete() {
        if (!entry) {
            return;
        }
        const result = deleteEntry(entry.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast("流水已删除", "success");
        onClose();
    }

    return (
        <>
            <Modal
                open={entry !== null}
                onClose={onClose}
                title="流水详情"
                description={entry ? `${kindLabel} · ${formatDateFull(entry.date)}` : undefined}
                size="sm"
                footer={
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={onClose}>
                            关闭
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1"
                            onClick={() => setConfirmOpen(true)}
                        >
                            <Trash2 className="size-3.5" />
                            删除
                        </Button>
                    </div>
                }
            >
                {entry && (
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-line bg-surface-2/55 px-4 py-5 text-center">
                            <p className="text-[11px] font-medium text-muted">
                                {entry.kind === "repayment" ? "还款金额" : kindLabel}
                            </p>
                            <p
                                className={cn(
                                    "mt-1 text-3xl font-bold tracking-tight",
                                    entry.kind === "income"
                                        ? "text-success"
                                        : entry.kind === "repayment"
                                          ? "text-muted"
                                          : entry.billId
                                            ? "text-liability"
                                            : "text-text",
                                )}
                            >
                                <Money value={entry.amount} currency={currency} sign={sign} />
                            </p>
                            {entry.kind === "repayment" && (
                                <span className="mt-2 inline-flex chip bg-accent-soft text-accent">
                                    不计入支出
                                </span>
                            )}
                        </div>

                        <dl className="space-y-2.5 text-xs">
                            {category && (
                                <DetailRow label="分类">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>{category.emoji}</span>
                                        {category.name}
                                    </span>
                                </DetailRow>
                            )}
                            {member && (
                                <DetailRow label="成员">
                                    <span
                                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                        style={{
                                            backgroundColor: `${member.color}20`,
                                            color: member.color,
                                        }}
                                    >
                                        {member.name}
                                    </span>
                                </DetailRow>
                            )}
                            {entry.kind === "expense" && entry.billId ? (
                                <>
                                    <DetailRow label="付款方式">
                                        <span className="inline-flex items-center gap-1.5 text-liability">
                                            <CreditCard className="size-3.5" />
                                            赊账 · {liability?.name ?? "负债账户"}
                                        </span>
                                    </DetailRow>
                                    {bill && (
                                        <>
                                            <DetailRow label="账单">
                                                {bill.title}
                                            </DetailRow>
                                            <DetailRow label="待还">
                                                <span className="font-semibold text-liability">
                                                    {formatCents(
                                                        getBillRemaining(bill, entries),
                                                        currency,
                                                    )}
                                                </span>
                                            </DetailRow>
                                            <DetailRow label="状态">
                                                {getBillStatus(bill, entries) === "paid"
                                                    ? "已还清"
                                                    : getBillStatus(bill, entries) === "partial"
                                                      ? "部分还款"
                                                      : "待还"}
                                            </DetailRow>
                                            <DetailRow label="到期">
                                                {
                                                    getBillDueInfo(
                                                        bill,
                                                        getBillStatus(bill, entries),
                                                    ).label
                                                }
                                            </DetailRow>
                                        </>
                                    )}
                                </>
                            ) : (
                                <DetailRow label={entry.kind === "income" ? "收款账户" : "账户"}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Wallet className="size-3.5 text-muted" />
                                        {asset ? `${asset.emoji} ${asset.name}` : "未指定账户"}
                                    </span>
                                </DetailRow>
                            )}
                            {entry.kind === "repayment" && (
                                <>
                                    <DetailRow label="还款账户">
                                        <span className="inline-flex items-center gap-1.5">
                                            <Wallet className="size-3.5 text-muted" />
                                            {asset ? `${asset.emoji} ${asset.name}` : "未指定"}
                                        </span>
                                    </DetailRow>
                                    <DetailRow label="负债账户">
                                        <span className="inline-flex items-center gap-1.5 text-liability">
                                            <CreditCard className="size-3.5" />
                                            {liability?.name ?? "未指定"}
                                        </span>
                                    </DetailRow>
                                </>
                            )}
                            {entry.note && <DetailRow label="备注">{entry.note}</DetailRow>}
                        </dl>

                        <p className="rounded-xl bg-surface-2/70 px-3 py-2.5 text-[10px] leading-relaxed text-muted">
                            删除后账户余额和账单待还金额会自动重算；已有还款的赊账需要先删除还款记录。
                        </p>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="删除这笔流水？"
                description="删除后余额和账单进度会自动重算。"
                confirmLabel="删除"
                onConfirm={handleDelete}
            />
        </>
    );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-line/60 pb-2.5 last:border-0">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="text-right font-medium text-text">{children}</dd>
        </div>
    );
}
