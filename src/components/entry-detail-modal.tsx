/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useState, type ReactNode } from "react";
import { CreditCard, MapPin, Trash2, Wallet } from "lucide-react";
import type { Entry } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AttachmentList } from "@/components/attachment-list";
import { Money } from "@/components/money";
import { formatCents } from "@/domain/money";
import {
    getBillDueInfo,
    getBillRemaining,
    getBillStatus,
} from "@/domain/ledger";
import { formatDateFull } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { useCanModifyOwner } from "@/store/member-session";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface EntryDetailModalProps {
    entry: Entry | null;
    onClose: () => void;
}

export function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
    const accounts = useLedgerStore((state) => state.accounts);
    const bills = useLedgerStore((state) => state.bills);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tags = useLedgerStore((state) => state.tags);
    const entries = useLedgerStore((state) => state.entries);
    const deleteEntry = useLedgerStore((state) => state.deleteEntry);
    const currency = useCurrency();
    const canEdit = useCanModifyOwner(entry?.ownerId);
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
    const toAccount = entry?.toAccountId
        ? accounts.find((item) => item.id === entry.toAccountId)
        : undefined;
    const member = entry?.memberId
        ? members.find((item) => item.id === entry.memberId)
        : undefined;
    const entryTags = (entry?.tagIds ?? [])
        .map((tagId) => tags.find((item) => item.id === tagId))
        .filter((tag): tag is (typeof tags)[number] => tag !== undefined);

    const kindLabel =
        entry?.kind === "expense"
            ? t("支出")
            : entry?.kind === "income"
              ? t("收入")
              : entry?.kind === "transfer"
                ? t("转账")
                : t("还款");
    const sign =
        entry?.kind === "income"
            ? "positive"
            : entry?.kind === "transfer"
              ? "none"
              : "negative";

    function handleDelete() {
        if (!entry) {
            return;
        }
        const result = deleteEntry(entry.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("流水已删除"), "success");
        onClose();
    }

    return (
        <>
            <Modal
                open={entry !== null}
                onClose={onClose}
                title={t("流水详情")}
                description={entry ? `${kindLabel} · ${formatDateFull(entry.date)}` : undefined}
                size="sm"
                footer={
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={onClose}>{t("关闭")}</Button>
                        {canEdit && (
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={() => setConfirmOpen(true)}
                            >
                                <Trash2 className="size-3.5" />{` ${t("删除")}`}</Button>
                        )}
                    </div>
                }
            >
                {entry && (
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-line bg-surface-2/55 px-4 py-5 text-center">
                            <p className="text-[11px] font-medium text-muted">
                                {entry.kind === "repayment"
                                    ? t("还款金额")
                                    : entry.kind === "transfer"
                                      ? t("转账金额")
                                      : kindLabel}
                            </p>
                            <p
                                className={cn(
                                    "mt-1 text-3xl font-bold tracking-tight",
                                    entry.kind === "income"
                                        ? "text-success"
                                        : entry.kind === "repayment" ||
                                            entry.kind === "transfer"
                                          ? "text-muted"
                                          : entry.billId
                                            ? "text-liability"
                                            : "text-text",
                                )}
                            >
                                <Money value={entry.amount} currency={currency} sign={sign} />
                            </p>
                            {entry.kind === "repayment" && (
                                <span className="mt-2 inline-flex chip bg-accent-soft text-accent">{t("不计支出")}</span>
                            )}
                            {entry.kind === "expense" && entry.billId && (
                                <span className="mt-2 inline-flex chip bg-liability-soft text-liability">{t("支出 · 负债")}</span>
                            )}
                        </div>

                        <dl className="space-y-2.5 text-xs">
                            {category && (
                                <DetailRow label={t("分类")}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>{category.emoji}</span>
                                        {category.name}
                                    </span>
                                </DetailRow>
                            )}
                            {member && (
                                <DetailRow label={t("成员")}>
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
                            {entry.kind === "transfer" ? (
                                <>
                                    <DetailRow label={t("转出账户")}>
                                        <span className="inline-flex items-center gap-1.5">
                                            <Wallet className="size-3.5 text-muted" />
                                            {asset ? `${asset.emoji} ${asset.name}` : t("未指定")}
                                        </span>
                                    </DetailRow>
                                    <DetailRow label={t("转入账户")}>
                                        <span className="inline-flex items-center gap-1.5">
                                            <Wallet className="size-3.5 text-muted" />
                                            {toAccount
                                                ? `${toAccount.emoji} ${toAccount.name}`
                                                : t("未指定")}
                                        </span>
                                    </DetailRow>
                                </>
                            ) : entry.kind === "expense" && entry.billId ? (
                                <>
                                    <DetailRow label={t("付款方式")}>
                                        <span className="inline-flex items-center gap-1.5 text-liability">
                                            <CreditCard className="size-3.5" />{` ${t("赊账 ·")} `}{liability?.name ?? t("负债账户")}
                                        </span>
                                    </DetailRow>
                                    {bill && (
                                        <>
                                            <DetailRow label={t("账单")}>
                                                {bill.title}
                                            </DetailRow>
                                            <DetailRow label={t("待还")}>
                                                <span className="font-semibold text-liability">
                                                    {formatCents(
                                                        getBillRemaining(bill, entries),
                                                        currency,
                                                    )}
                                                </span>
                                            </DetailRow>
                                            <DetailRow label={t("状态")}>
                                                {getBillStatus(bill, entries) === "paid"
                                                    ? t("已还清")
                                                    : getBillStatus(bill, entries) === "partial"
                                                      ? t("部分还款")
                                                      : t("待还")}
                                            </DetailRow>
                                            <DetailRow label={t("到期")}>
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
                                <DetailRow label={entry.kind === "income" ? t("收款账户") : t("账户")}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Wallet className="size-3.5 text-muted" />
                                        {asset ? `${asset.emoji} ${asset.name}` : t("未指定账户")}
                                    </span>
                                </DetailRow>
                            )}
                            {entry.kind === "repayment" && (
                                <>
                                    <DetailRow label={t("还款账户")}>
                                        <span className="inline-flex items-center gap-1.5">
                                            <Wallet className="size-3.5 text-muted" />
                                            {asset ? `${asset.emoji} ${asset.name}` : t("未指定")}
                                        </span>
                                    </DetailRow>
                                    <DetailRow label={t("负债账户")}>
                                        <span className="inline-flex items-center gap-1.5 text-liability">
                                            <CreditCard className="size-3.5" />
                                            {liability?.name ?? t("未指定")}
                                        </span>
                                    </DetailRow>
                                </>
                            )}
                            {entryTags.length > 0 && (
                                <DetailRow label={t("标签")}>
                                    <span className="flex flex-wrap justify-end gap-1">
                                        {entryTags.map((tag) => (
                                            <span
                                                key={tag.id}
                                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                style={{
                                                    backgroundColor: `${tag.color}20`,
                                                    color: tag.color,
                                                }}
                                            >
                                                {tag.name}
                                            </span>
                                        ))}
                                    </span>
                                </DetailRow>
                            )}
                            {entry.originalAmount && (
                                <DetailRow label={t("原始金额")}>
                                    {formatCents(
                                        entry.originalAmount.amount,
                                        entry.originalAmount.currency,
                                    )}{" "}
                                    <span className="text-[10px] text-muted">
                                        @ {entry.originalAmount.rate}
                                    </span>
                                </DetailRow>
                            )}
                            {entry.location && (
                                <DetailRow label={t("位置")}>
                                    <a
                                        href={`https://www.openstreetmap.org/?mlat=${entry.location.lat}&mlon=${entry.location.lng}#map=16/${entry.location.lat}/${entry.location.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-accent hover:underline"
                                    >
                                        <MapPin className="size-3.5" />
                                        {entry.location.label ||
                                            `${entry.location.lat.toFixed(4)}, ${entry.location.lng.toFixed(4)}`}
                                    </a>
                                </DetailRow>
                            )}
                            {entry.ownerName && (
                                <DetailRow label={t("记账人")}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="grid size-5 place-items-center rounded-full bg-surface-3 text-[9px] font-bold text-muted">
                                            {entry.ownerName.slice(0, 1)}
                                        </span>
                                        {entry.ownerName}
                                        {!canEdit && (
                                            <span className="text-[9px] text-muted">{t("只读")}</span>
                                        )}
                                    </span>
                                </DetailRow>
                            )}
                            {entry.note && <DetailRow label={t("备注")}>{entry.note}</DetailRow>}
                        </dl>

                        <AttachmentList
                            target={{ kind: "entry", id: entry.id }}
                            attachmentIds={entry.attachmentIds}
                            readOnly={!canEdit}
                        />

                        <p className="rounded-xl bg-surface-2/70 px-3 py-2.5 text-[10px] leading-relaxed text-muted">{t("删除后账户余额和账单待还金额会自动重算；已有还款的赊账需要先删除还款记录。")}</p>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title={t("删除这笔流水？")}
                description={t("删除后余额和账单进度会自动重算。")}
                confirmLabel={t("删除")}
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
