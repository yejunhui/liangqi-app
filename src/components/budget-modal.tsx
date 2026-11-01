/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Budget, BudgetPeriod } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { parseAmountToCents } from "@/domain/money";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface BudgetModalProps {
    open: boolean;
    budget: Budget | null;
    onClose: () => void;
}

export function BudgetModal({ open, budget, onClose }: BudgetModalProps) {
    const categories = useLedgerStore((state) => state.categories);
    const tags = useLedgerStore((state) => state.tags);
    const members = useLedgerStore((state) => state.members);
    const addBudget = useLedgerStore((state) => state.addBudget);
    const updateBudget = useLedgerStore((state) => state.updateBudget);

    const [name, setName] = useState("");
    const [period, setPeriod] = useState<BudgetPeriod>("month");
    const [amount, setAmount] = useState("");
    const [categoryIds, setCategoryIds] = useState<string[]>([]);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setName(budget?.name ?? "");
        setPeriod(budget?.period ?? "month");
        setAmount(budget ? (budget.amount / 100).toFixed(2) : "");
        setCategoryIds(budget?.categoryIds ?? []);
        setTagIds(budget?.tagIds ?? []);
        setMemberIds(budget?.memberIds ?? []);
        setError("");
    }, [open, budget]);

    const expenseCategories = useMemo(() => {
        const list = categories.filter((category) => category.kind === "expense");
        const roots = list.filter((category) => !category.parent);
        return roots.flatMap((root) => [
            root,
            ...list.filter((category) => category.parent === root.id),
        ]);
    }, [categories]);

    const editing = budget !== null;

    function toggle(list: string[], id: string): string[] {
        return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!name.trim()) {
            setError(t("预算名称不能为空"));
            return;
        }
        const cents = parseAmountToCents(amount);
        if (cents === null || cents <= 0) {
            setError(t("请输入大于 0 的预算金额"));
            return;
        }
        const input = {
            name,
            period,
            amount: cents,
            categoryIds,
            tagIds,
            memberIds,
        };
        const result = editing ? updateBudget(budget.id, input) : addBudget(input);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(editing ? t("预算已更新") : t("预算已创建"), "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? t("编辑预算") : t("添加预算")}
            description={t("按分类、标签或成员圈定范围，超支时会在首页提醒。")}
            size="md"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="budget-form" className="flex-1">
                        {editing ? t("保存") : t("创建预算")}
                    </Button>
                </div>
            }
        >
            <form id="budget-form" className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("名称")}</span>
                        <input
                            className="field"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t("例如：餐饮月度预算")}
                            autoFocus
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("金额")}</span>
                        <input
                            className="field"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            placeholder="0.00"
                        />
                    </label>
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold text-muted">{t("周期")}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: "month", label: t("每月"), hint: t("按自然月重置") },
                                { value: "year", label: t("每年"), hint: t("按自然年重置") },
                            ] as const
                        ).map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setPeriod(option.value)}
                                className={cn(
                                    "rounded-xl border p-3 text-left transition",
                                    period === option.value
                                        ? "border-accent bg-accent-soft/70"
                                        : "border-line bg-surface hover:border-line-strong",
                                )}
                            >
                                <span className="block text-xs font-semibold text-text">
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    {option.hint}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold text-muted">{`${t("支出分类")} `}<span className="ml-1 font-normal text-muted/70">{t("不选则统计全部支出")}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {expenseCategories.map((category) => {
                            const parent = category.parent
                                ? categories.find((item) => item.id === category.parent)
                                : undefined;
                            const active = categoryIds.includes(category.id);
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() =>
                                        setCategoryIds((current) =>
                                            toggle(current, category.id),
                                        )
                                    }
                                    className={cn(
                                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                                        active
                                            ? "border-accent bg-accent-soft text-accent"
                                            : "border-line bg-surface text-text hover:border-line-strong",
                                    )}
                                >
                                    <span>{category.emoji}</span>
                                    {parent ? `${parent.name} / ` : ""}
                                    {category.name}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted">{t("选择父分类时，会自动包含它的二级分类。")}</p>
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold text-muted">{`${t("标签")} `}<span className="ml-1 font-normal text-muted/70">{t("不选则不按标签筛选")}</span>
                    </p>
                    {tags.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-3 py-2.5 text-[11px] text-muted">{t("还没有标签，可以在标签页添加。")}</p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag) => {
                                const active = tagIds.includes(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() =>
                                            setTagIds((current) => toggle(current, tag.id))
                                        }
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition",
                                            active
                                                ? "border-accent bg-accent-soft text-accent"
                                                : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                                        )}
                                    >
                                        <span
                                            className="size-2 rounded-full"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold text-muted">{`${t("成员")} `}<span className="ml-1 font-normal text-muted/70">{t("不选则统计所有成员")}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {members.map((member) => {
                            const active = memberIds.includes(member.id);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() =>
                                        setMemberIds((current) => toggle(current, member.id))
                                    }
                                    className={cn(
                                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                                        active
                                            ? "border-accent bg-accent-soft text-accent"
                                            : "border-line bg-surface text-text hover:border-line-strong",
                                    )}
                                >
                                    <span
                                        className="grid size-4 place-items-center rounded-full text-[8px] font-bold text-white"
                                        style={{ backgroundColor: member.color }}
                                    >
                                        {member.name.slice(0, 1)}
                                    </span>
                                    {member.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {error && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
}
