/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Pause, Pencil, Play, Plus, Repeat, Trash2, Zap } from "lucide-react";
import type { RecurringRule } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { RecurringModal } from "@/components/recurring-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { formatCents } from "@/domain/money";
import {
    frequencyLabel,
    getDueOccurrences,
    getNextRecurringDate,
} from "@/domain/recurring";
import { formatDateFull } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { useCurrentActor } from "@/store/identity";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

export function Recurring() {
    const rules = useLedgerStore((state) => state.recurringRules);
    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const updateRecurringRule = useLedgerStore((state) => state.updateRecurringRule);
    const deleteRecurringRule = useLedgerStore((state) => state.deleteRecurringRule);
    const postDueRecurring = useLedgerStore((state) => state.postDueRecurring);
    const currency = useCurrency();
    const actor = useCurrentActor();

    const [now] = useState(() => Date.now());
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
    const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null);

    const orderedRules = useMemo(
        () =>
            [...rules].sort((a, b) => {
                if (a.enabled !== b.enabled) {
                    return a.enabled ? -1 : 1;
                }
                return a.nextDueDate - b.nextDueDate;
            }),
        [rules],
    );
    const dueCount = useMemo(
        () =>
            rules.reduce(
                (sum, rule) => sum + getDueOccurrences(rule, now).length,
                0,
            ),
        [rules, now],
    );
    const activeCount = rules.filter((rule) => rule.enabled).length;
    const nextUpcoming = useMemo(() => {
        const rule = orderedRules.find((item) => item.enabled);
        return rule ? getNextRecurringDate(rule, now) : undefined;
    }, [orderedRules, now]);

    function openCreate() {
        setEditingRule(null);
        setModalOpen(true);
    }

    function openEdit(rule: RecurringRule) {
        setEditingRule(rule);
        setModalOpen(true);
    }

    function handlePostDue() {
        const result = postDueRecurring();
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(
            result.posted && result.posted > 0
                ? `已自动入账 ${result.posted} 笔`
                : "没有到期的周期记账",
            "success",
        );
    }

    function handleDelete() {
        if (!deletingRule) {
            return;
        }
        const result = deleteRecurringRule(deletingRule.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast("周期记账已删除，已生成的流水保留", "success");
        setDeletingRule(null);
    }

    return (
        <div>
            <PageHeader
                eyebrow="通用记账"
                title="周期记账"
                description="房租、工资、订阅等固定收支，到点自动生成流水。"
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handlePostDue}>
                            <Zap className="size-4" />
                            立即入账
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus className="size-4" />
                            添加周期记账
                        </Button>
                    </div>
                }
            />

            {rules.length === 0 ? (
                <EmptyState
                    icon={Repeat}
                    title="还没有周期记账"
                    description="把每月房租、工资或订阅设成周期记账，到日期自动生成流水。"
                    action={
                        <Button size="sm" onClick={openCreate}>
                            <Plus className="size-3.5" />
                            添加第一条
                        </Button>
                    }
                />
            ) : (
                <>
                    <section className="card mb-4 grid grid-cols-3 gap-3 p-5">
                        <div>
                            <p className="text-[10px] text-muted">启用中</p>
                            <p className="mt-1 text-base font-bold tabular-nums text-text">
                                {activeCount} 条
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted">待入账</p>
                            <p
                                className={cn(
                                    "mt-1 text-base font-bold tabular-nums",
                                    dueCount > 0 ? "text-liability" : "text-text",
                                )}
                            >
                                {dueCount} 笔
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted">下次入账</p>
                            <p className="mt-1 text-base font-bold text-text">
                                {nextUpcoming ? formatDateFull(nextUpcoming) : "无"}
                            </p>
                        </div>
                    </section>

                    {dueCount > 0 && (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-liability/20 bg-liability-soft/50 px-4 py-3">
                            <p className="text-xs font-medium text-liability">
                                有 {dueCount} 笔周期记账已到日期，立即入账会按日期补记流水。
                            </p>
                            <Button size="sm" onClick={handlePostDue}>
                                <Zap className="size-3.5" />
                                立即入账
                            </Button>
                        </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                        {orderedRules.map((rule) => {
                            const category = categories.find(
                                (item) => item.id === rule.categoryId,
                            );
                            const account = accounts.find(
                                (item) =>
                                    item.id ===
                                    (rule.liabilityAccountId ?? rule.accountId),
                            );
                            const member = members.find((item) => item.id === rule.memberId);
                            const next = getNextRecurringDate(rule, now);
                            const due = getDueOccurrences(rule, now).length;
                            const canEdit = !rule.ownerId || rule.ownerId === actor.id;
                            return (
                                <article
                                    key={rule.id}
                                    className={cn(
                                        "card p-4",
                                        !rule.enabled && "opacity-70",
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className="grid size-10 shrink-0 place-items-center rounded-xl text-lg"
                                            style={{
                                                backgroundColor: `${category?.color ?? "#a8a29e"}20`,
                                            }}
                                        >
                                            {category?.emoji ?? "🔁"}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <h2 className="truncate text-sm font-bold text-text">
                                                    {rule.name}
                                                </h2>
                                                <span className="chip bg-surface-3 text-muted">
                                                    {frequencyLabel(rule)}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "chip",
                                                        rule.kind === "income"
                                                            ? "bg-success-soft text-success"
                                                            : rule.liabilityAccountId
                                                              ? "bg-liability-soft text-liability"
                                                              : "bg-accent-soft text-accent",
                                                    )}
                                                >
                                                    {rule.kind === "income"
                                                        ? "收入"
                                                        : rule.liabilityAccountId
                                                          ? "赊账支出"
                                                          : "支出"}
                                                </span>
                                                {due > 0 && (
                                                    <span className="chip bg-liability-soft text-liability">
                                                        待入账 {due}
                                                    </span>
                                                )}
                                                {!rule.enabled && (
                                                    <span className="chip bg-surface-3 text-muted">
                                                        已暂停
                                                    </span>
                                                )}
                                                {rule.ownerName && (
                                                    <span className="chip bg-surface-3 text-muted">
                                                        记 · {rule.ownerName}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 truncate text-[11px] text-muted">
                                                {category?.name ?? "分类"}
                                                {account ? ` · ${account.name}` : ""}
                                                {member ? ` · ${member.name}` : ""}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p
                                                className={cn(
                                                    "text-sm font-bold tabular-nums",
                                                    rule.kind === "income"
                                                        ? "text-success"
                                                        : rule.liabilityAccountId
                                                          ? "text-liability"
                                                          : "text-text",
                                                )}
                                            >
                                                {formatCents(rule.amount, currency)}
                                            </p>
                                            <p className="text-[10px] text-muted">
                                                {next ? formatDateFull(next) : "已结束"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-1.5 border-t border-line/70 pt-3">
                                        {canEdit && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateRecurringRule(rule.id, {
                                                            enabled: !rule.enabled,
                                                        })
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[10px] font-medium text-muted transition hover:text-text"
                                                >
                                                    {rule.enabled ? (
                                                        <Pause className="size-3" />
                                                    ) : (
                                                        <Play className="size-3" />
                                                    )}
                                                    {rule.enabled ? "暂停" : "启用"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(rule)}
                                                    className="grid size-7 place-items-center rounded-lg border border-line text-muted transition hover:text-text"
                                                    aria-label="编辑周期记账"
                                                >
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeletingRule(rule)}
                                                    className="grid size-7 place-items-center rounded-lg border border-line text-muted transition hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
                                                    aria-label="删除周期记账"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </>
                                        )}
                                        {!canEdit && (
                                            <span className="text-[10px] text-muted">
                                                只能查看其他成员创建的周期记账
                                            </span>
                                        )}
                                        {rule.lastPostedAt && (
                                            <span className="ml-auto text-[10px] text-muted">
                                                上次 {formatDateFull(rule.lastPostedAt)}
                                            </span>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </>
            )}

            <RecurringModal
                open={modalOpen}
                rule={editingRule}
                onClose={() => {
                    setModalOpen(false);
                    setEditingRule(null);
                }}
            />

            <ConfirmDialog
                open={deletingRule !== null}
                onClose={() => setDeletingRule(null)}
                title="删除这条周期记账？"
                description={
                    deletingRule
                        ? `“${deletingRule.name}”以后不再自动入账，已经生成的流水会保留。`
                        : ""
                }
                confirmLabel="删除"
                onConfirm={handleDelete}
            />
        </div>
    );
}
