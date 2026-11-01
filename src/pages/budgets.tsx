/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import type { Budget } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { BudgetModal } from "@/components/budget-modal";
import { BudgetSuggestionsModal } from "@/components/budget-suggestions-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { getBudgetProgressList } from "@/domain/budgets";
import { suggestBudgets } from "@/domain/budget-suggestions";
import { formatCents } from "@/domain/money";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

export function Budgets() {
    const budgets = useLedgerStore((state) => state.budgets);
    const entries = useLedgerStore((state) => state.entries);
    const categories = useLedgerStore((state) => state.categories);
    const tags = useLedgerStore((state) => state.tags);
    const members = useLedgerStore((state) => state.members);
    const deleteBudget = useLedgerStore((state) => state.deleteBudget);
    const currency = useCurrency();

    const [modalOpen, setModalOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [now] = useState(() => Date.now());

    const progressList = useMemo(
        () => getBudgetProgressList(budgets, entries, categories, now),
        [budgets, entries, categories, now],
    );
    const totalAmount = progressList.reduce((sum, item) => sum + item.budget.amount, 0);
    const totalSpent = progressList.reduce((sum, item) => sum + item.spent, 0);
    const overCount = progressList.filter((item) => item.spent > item.budget.amount).length;
    const suggestions = useMemo(
        () => suggestBudgets(entries, categories, budgets, now),
        [entries, categories, budgets, now],
    );

    function openCreate() {
        setEditingBudget(null);
        setModalOpen(true);
    }

    function openEdit(budget: Budget) {
        setEditingBudget(budget);
        setModalOpen(true);
    }

    function handleDelete() {
        if (!deletingBudget) {
            return;
        }
        const result = deleteBudget(deletingBudget.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("预算已删除"), "success");
        setDeletingBudget(null);
    }

    return (
        <div>
            <PageHeader
                eyebrow={t("通用记账")}
                title={t("预算")}
                description={t("按分类、标签或成员设置月度 / 年度预算，超支会在首页提醒。")}
                action={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setSuggestionsOpen(true)}
                        >
                            <Sparkles className="size-4" />{` ${t("智能建议")}`}</Button>
                        <Button onClick={openCreate}>
                            <Plus className="size-4" />{` ${t("添加预算")}`}</Button>
                    </div>
                }
            />

            {budgets.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title={t("还没有预算")}
                    description={t("给餐饮、交通或某次旅行设一个预算，花钱时心里更有数。")}
                    action={
                        <Button size="sm" onClick={openCreate}>
                            <Plus className="size-3.5" />{` ${t("添加第一个预算")}`}</Button>
                    }
                />
            ) : (
                <>
                    <section className="card mb-4 grid grid-cols-3 gap-3 p-5">
                        <div>
                            <p className="text-[10px] text-muted">{t("预算总额")}</p>
                            <p className="mt-1 text-base font-bold tabular-nums text-text">
                                {formatCents(totalAmount, currency)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted">{t("已使用")}</p>
                            <p className="mt-1 text-base font-bold tabular-nums text-text">
                                {formatCents(totalSpent, currency)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted">{t("超支预算")}</p>
                            <p
                                className={cn(
                                    "mt-1 text-base font-bold tabular-nums",
                                    overCount > 0 ? "text-danger" : "text-success",
                                )}
                            >
                                {overCount}{` ${t("个")}`}</p>
                        </div>
                    </section>

                    <div className="grid gap-3 md:grid-cols-2">
                        {progressList.map(
                            ({ budget, spent, remaining, progress, periodLabel }) => {
                                const percent = Math.round(progress * 100);
                                const over = spent > budget.amount;
                                const budgetCategories = budget.categoryIds
                                    .map((id) => categories.find((item) => item.id === id))
                                    .filter((item): item is (typeof categories)[number] =>
                                        item !== undefined,
                                    );
                                const budgetTags = budget.tagIds
                                    .map((id) => tags.find((item) => item.id === id))
                                    .filter((item): item is (typeof tags)[number] =>
                                        item !== undefined,
                                    );
                                const budgetMembers = budget.memberIds
                                    .map((id) => members.find((item) => item.id === id))
                                    .filter((item): item is (typeof members)[number] =>
                                        item !== undefined,
                                    );
                                return (
                                    <article key={budget.id} className="card p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <h2 className="truncate text-sm font-bold text-text">
                                                        {budget.name}
                                                    </h2>
                                                    <span className="chip bg-surface-3 text-muted">
                                                        {periodLabel}
                                                    </span>
                                                    {over && (
                                                        <span className="chip bg-danger-soft text-danger">{t("已超支")}</span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-[11px] text-muted">{`${t("已用")} `}{formatCents(spent, currency)} /{" "}
                                                    {formatCents(budget.amount, currency)}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(budget)}
                                                    className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                                    aria-label={t("编辑预算")}
                                                >
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeletingBudget(budget)}
                                                    className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
                                                    aria-label={t("删除预算")}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        over ? "bg-danger" : "bg-accent",
                                                    )}
                                                    style={{
                                                        width:
                                                            progress === 0
                                                                ? "0%"
                                                                : `${Math.max(2, Math.min(100, percent))}%`,
                                                    }}
                                                />
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-between text-[10px]">
                                                <span
                                                    className={cn(
                                                        over ? "text-danger" : "text-muted",
                                                    )}
                                                >
                                                    {over
                                                        ? t("超出 {0}", [formatCents(-remaining, currency)])
                                                        : t("剩余 {0}", [formatCents(remaining, currency)])}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "tabular-nums",
                                                        over ? "text-danger" : "text-muted",
                                                    )}
                                                >
                                                    {percent}%
                                                </span>
                                            </div>
                                        </div>

                                        {(budgetCategories.length > 0 ||
                                            budgetTags.length > 0 ||
                                            budgetMembers.length > 0) && (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {budgetCategories.map((category) => (
                                                    <span
                                                        key={category.id}
                                                        className="chip bg-surface-2 text-muted"
                                                    >
                                                        {category.emoji} {category.name}
                                                    </span>
                                                ))}
                                                {budgetTags.map((tag) => (
                                                    <span
                                                        key={tag.id}
                                                        className="chip"
                                                        style={{
                                                            backgroundColor: `${tag.color}20`,
                                                            color: tag.color,
                                                        }}
                                                    >
                                                        {tag.name}
                                                    </span>
                                                ))}
                                                {budgetMembers.map((member) => (
                                                    <span
                                                        key={member.id}
                                                        className="chip"
                                                        style={{
                                                            backgroundColor: `${member.color}20`,
                                                            color: member.color,
                                                        }}
                                                    >
                                                        {member.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </article>
                                );
                            },
                        )}
                    </div>
                </>
            )}

            <BudgetModal
                open={modalOpen}
                budget={editingBudget}
                onClose={() => {
                    setModalOpen(false);
                    setEditingBudget(null);
                }}
            />

            <BudgetSuggestionsModal
                open={suggestionsOpen}
                suggestions={suggestions}
                currency={currency}
                onClose={() => setSuggestionsOpen(false)}
            />

            <ConfirmDialog
                open={deletingBudget !== null}
                onClose={() => setDeletingBudget(null)}
                title={t("删除这个预算？")}
                description={
                    deletingBudget
                        ? t("“{0}”的进度会被移除，历史流水不受影响。", [deletingBudget.name])
                        : ""
                }
                confirmLabel={t("删除预算")}
                onConfirm={handleDelete}
            />
        </div>
    );
}
