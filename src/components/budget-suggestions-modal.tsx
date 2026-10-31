/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "react";
import type { BudgetSuggestion } from "@/domain/budget-suggestions";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { formatCents, parseAmountToCents } from "@/domain/money";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

interface BudgetSuggestionsModalProps {
    open: boolean;
    suggestions: BudgetSuggestion[];
    currency: string;
    onClose: () => void;
}

export function BudgetSuggestionsModal({
    open,
    suggestions,
    currency,
    onClose,
}: BudgetSuggestionsModalProps) {
    const addBudget = useLedgerStore((state) => state.addBudget);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [amounts, setAmounts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) {
            return;
        }
        setSelected(new Set(suggestions.map((item) => item.categoryId)));
        setAmounts(
            Object.fromEntries(
                suggestions.map((item) => [
                    item.categoryId,
                    (item.amount / 100).toFixed(2),
                ]),
            ),
        );
    }, [open, suggestions]);

    function toggle(categoryId: string) {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }

    function handleCreate() {
        let created = 0;
        for (const suggestion of suggestions) {
            if (!selected.has(suggestion.categoryId)) {
                continue;
            }
            const cents = parseAmountToCents(amounts[suggestion.categoryId] ?? "");
            if (cents === null || cents <= 0) {
                continue;
            }
            const result = addBudget({
                name: `${suggestion.name}预算`,
                period: "month",
                amount: cents,
                categoryIds: [suggestion.categoryId],
            });
            if (result.ok) {
                created += 1;
            }
        }
        if (created === 0) {
            toast("没有创建预算，请检查金额", "error");
            return;
        }
        toast(`已创建 ${created} 个预算`, "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="智能预算建议"
            description="根据最近 3 个完整月份的分类平均支出，生成月度预算草案；创建前可以修改金额。"
            size="md"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        取消
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={handleCreate}
                        disabled={selected.size === 0}
                    >
                        创建 {selected.size} 个预算
                    </Button>
                </div>
            }
        >
            {suggestions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-4 py-8 text-center text-xs text-muted">
                    最近 3 个完整月份没有足够的支出数据，先记几笔账再来。
                </p>
            ) : (
                <div className="space-y-2">
                    {suggestions.map((suggestion) => {
                        const active = selected.has(suggestion.categoryId);
                        return (
                            <div
                                key={suggestion.categoryId}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl border p-3 transition",
                                    active
                                        ? "border-accent bg-accent-soft/35"
                                        : "border-line bg-surface-2/35",
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(suggestion.categoryId)}
                                    className={cn(
                                        "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                                        active
                                            ? "border-accent bg-accent text-surface"
                                            : "border-line-strong bg-surface text-transparent",
                                    )}
                                    aria-pressed={active}
                                    aria-label={`选择 ${suggestion.name}`}
                                >
                                    ✓
                                </button>
                                <span
                                    className="grid size-9 shrink-0 place-items-center rounded-xl text-base"
                                    style={{
                                        backgroundColor: `${suggestion.color}20`,
                                    }}
                                >
                                    {suggestion.emoji}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-text">
                                        {suggestion.name}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-muted">
                                        月均 {formatCents(suggestion.average, currency)}
                                    </p>
                                </div>
                                <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                                    <input
                                        className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right text-[11px] tabular-nums text-text outline-none"
                                        value={amounts[suggestion.categoryId] ?? ""}
                                        onChange={(event) =>
                                            setAmounts((current) => ({
                                                ...current,
                                                [suggestion.categoryId]: event.target.value,
                                            }))
                                        }
                                        inputMode="decimal"
                                        aria-label={`${suggestion.name}预算金额`}
                                    />
                                    元
                                </label>
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
