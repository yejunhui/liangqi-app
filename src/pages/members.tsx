/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import type { Member } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { MemberModal } from "@/components/member-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

export function Members() {
    const members = useLedgerStore((state) => state.members);
    const bills = useLedgerStore((state) => state.bills);
    const entries = useLedgerStore((state) => state.entries);
    const deleteMember = useLedgerStore((state) => state.deleteMember);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Member | null>(null);
    const [deleting, setDeleting] = useState<Member | null>(null);

    const usage = useMemo(() => {
        const map = new Map<string, number>();
        for (const bill of bills) {
            if (bill.memberId) {
                map.set(bill.memberId, (map.get(bill.memberId) ?? 0) + 1);
            }
        }
        for (const entry of entries) {
            if (entry.memberId) {
                map.set(entry.memberId, (map.get(entry.memberId) ?? 0) + 1);
            }
        }
        return map;
    }, [bills, entries]);

    function openCreate() {
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(member: Member) {
        setEditing(member);
        setModalOpen(true);
    }

    function handleDelete() {
        if (!deleting) {
            return;
        }
        const result = deleteMember(deleting.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("成员已删除"), "success");
        setDeleting(null);
    }

    return (
        <div>
            <PageHeader
                eyebrow={t("家庭账本")}
                title={t("成员")}
                description={t("给账单和流水标记归属成员。成员只影响展示和归属，不影响金额、余额和统计。")}
                action={
                    <Button onClick={openCreate}>
                        <Plus className="size-4" />{` ${t("添加成员")}`}</Button>
                }
            />

            {members.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title={t("还没有成员")}
                    description={t("添加家庭成员后，记账时可以选择这笔账属于谁。")}
                    action={
                        <Button size="sm" onClick={openCreate}>
                            <Plus className="size-3.5" />{` ${t("添加成员")}`}</Button>
                    }
                />
            ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {members.map((member) => {
                        const count = usage.get(member.id) ?? 0;
                        return (
                            <article
                                key={member.id}
                                className="card group flex items-center gap-3 p-3.5 transition hover:border-line-strong"
                            >
                                <span
                                    className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                                    style={{ backgroundColor: member.color }}
                                >
                                    {member.name.slice(0, 1)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-semibold text-text">
                                        {member.name}
                                    </h3>
                                    <p className="mt-0.5 text-[10px] text-muted">
                                        {count > 0 ? t("{0} 处关联记录", [count]) : t("还没有使用")}
                                    </p>
                                </div>
                                <div
                                    className={cn(
                                        "flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100",
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => openEdit(member)}
                                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                        aria-label={t("编辑成员")}
                                    >
                                        <Pencil className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleting(member)}
                                        disabled={members.length <= 1}
                                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={t("删除成员")}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <p className="mt-5 text-center text-[10px] text-muted">{t("至少保留一个成员；已有账单或流水的成员不能删除。")}</p>

            <MemberModal
                open={modalOpen}
                member={editing}
                onClose={() => {
                    setModalOpen(false);
                    setEditing(null);
                }}
            />

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                title={t("删除这个成员？")}
                description={
                    deleting
                        ? t("“{0}”只有在没有关联账单和流水时才能删除。", [deleting.name])
                        : ""
                }
                confirmLabel={t("删除成员")}
                onConfirm={handleDelete}
            />
        </div>
    );
}
