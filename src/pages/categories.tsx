/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { Category, CategoryKind } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { Tabs, type TabItem } from "@/components/tabs";
import { CategoryModal } from "@/components/category-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { getCategoryUsage } from "@/domain/ledger";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

type Filter = CategoryKind;

export function Categories() {
    const categories = useLedgerStore((state) => state.categories);
    const entries = useLedgerStore((state) => state.entries);
    const bills = useLedgerStore((state) => state.bills);
    const deleteCategory = useLedgerStore((state) => state.deleteCategory);

    const [filter, setFilter] = useState<Filter>("expense");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

    const expenseCategories = useMemo(
        () => categories.filter((category) => category.kind === "expense"),
        [categories],
    );
    const incomeCategories = useMemo(
        () => categories.filter((category) => category.kind === "income"),
        [categories],
    );
    const visible = filter === "expense" ? expenseCategories : incomeCategories;
    const orderedVisible = useMemo(() => {
        const roots = visible.filter((category) => !category.parent);
        const result: Category[] = [];
        for (const root of roots) {
            result.push(root);
            result.push(...visible.filter((category) => category.parent === root.id));
        }
        result.push(...visible.filter((category) => category.parent && !result.includes(category)));
        return result;
    }, [visible]);

    const tabs: TabItem<Filter>[] = [
        { value: "expense", label: t("支出分类"), count: expenseCategories.length },
        { value: "income", label: t("收入分类"), count: incomeCategories.length },
    ];

    function openCreate() {
        setEditingCategory(null);
        setModalOpen(true);
    }

    function openEdit(category: Category) {
        setEditingCategory(category);
        setModalOpen(true);
    }

    function handleDelete() {
        if (!deletingCategory) {
            return;
        }
        const result = deleteCategory(deletingCategory.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("分类已删除"), "success");
        setDeletingCategory(null);
    }

    return (
        <div>
            <PageHeader
                title={t("分类")}
                description={t("用分类看清钱花在哪。分类只用于统计，不会影响账户余额。")}
                action={
                    <Button onClick={openCreate}>
                        <Plus className="size-4" />{` ${t("添加分类")}`}</Button>
                }
            />

            <div className="mb-4 flex items-center justify-between gap-3">
                <Tabs items={tabs} value={filter} onChange={setFilter} />
                <span className="hidden text-[11px] text-muted sm:block">{`${t("共")} `}{visible.length}{` ${t("个")}`}</span>
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    icon={Tags}
                    title={filter === "expense" ? t("还没有支出分类") : t("还没有收入分类")}
                    description={t("添加一个分类后，记账时就能选到它。")}
                    action={
                        <Button size="sm" onClick={openCreate}>
                            <Plus className="size-3.5" />{` ${t("添加分类")}`}</Button>
                    }
                />
            ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {orderedVisible.map((category) => {
                        const usage = getCategoryUsage(category.id, { entries, bills });
                        const parent = category.parent
                            ? categories.find((item) => item.id === category.parent)
                            : undefined;
                        return (
                            <article
                                key={category.id}
                                className={cn(
                                    "card group flex items-center gap-3 p-3.5 transition hover:border-line-strong",
                                    category.parent && "sm:ml-5",
                                )}
                            >
                                <span
                                    className="grid size-10 shrink-0 place-items-center rounded-xl text-lg"
                                    style={{ backgroundColor: `${category.color}20` }}
                                >
                                    {category.emoji}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-semibold text-text">
                                        {parent ? `${parent.name} / ` : ""}
                                        {category.name}
                                    </h3>
                                    <p className="mt-0.5 text-[10px] text-muted">
                                        {parent ? t("二级分类 · ") : ""}
                                        {usage > 0 ? t("{0} 处关联记录", [usage]) : t("还没有使用")}
                                    </p>
                                </div>
                                <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                />
                                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(category)}
                                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                        aria-label={t("编辑分类")}
                                    >
                                        <Pencil className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeletingCategory(category)}
                                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
                                        aria-label={t("删除分类")}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <p className={cn("mt-5 text-center text-[10px] text-muted")}>{t("默认分类可以改名或换图标；已有流水的分类不能删除。")}</p>

            <CategoryModal
                open={modalOpen}
                category={editingCategory}
                defaultKind={filter}
                onClose={() => {
                    setModalOpen(false);
                    setEditingCategory(null);
                }}
            />

            <ConfirmDialog
                open={deletingCategory !== null}
                onClose={() => setDeletingCategory(null)}
                title={t("删除这个分类？")}
                description={
                    deletingCategory
                        ? t("“{0}”只有在没有关联流水和账单时才能删除。", [deletingCategory.name])
                        : ""
                }
                confirmLabel={t("删除")}
                onConfirm={handleDelete}
            />
        </div>
    );
}
