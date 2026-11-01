/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Budget, Category, Entry } from "@/types";
import { startOfMonth } from "@/utils/date";
import { isRecognizedExpense } from "@/domain/ledger";

export interface BudgetSuggestion {
    categoryId: string;
    name: string;
    emoji: string;
    color: string;
    average: number;
    amount: number;
}

function endOfPreviousMonth(now: number): number {
    const date = new Date(startOfMonth(now));
    date.setDate(0);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

function monthStartBefore(now: number, months: number): number {
    const date = new Date(startOfMonth(now));
    date.setMonth(date.getMonth() - months);
    return date.getTime();
}

export function suggestBudgets(
    entries: Entry[],
    categories: Category[],
    budgets: Budget[],
    now = Date.now(),
    months = 3,
): BudgetSuggestion[] {
    const end = endOfPreviousMonth(now);
    const start = monthStartBefore(now, months);
    const byCategory = new Map<string, number>();
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    for (const entry of entries) {
        if (!isRecognizedExpense(entry) || entry.date < start || entry.date > end) {
            continue;
        }
        const category = entry.categoryId ? categoryMap.get(entry.categoryId) : undefined;
        if (!category) {
            continue;
        }
        const root = category.parent ? categoryMap.get(category.parent) ?? category : category;
        byCategory.set(root.id, (byCategory.get(root.id) ?? 0) + entry.amount);
    }

    const alreadyBudgeted = new Set(
        budgets.flatMap((budget) =>
            budget.categoryIds.flatMap((id) => {
                const category = categoryMap.get(id);
                return category?.parent ? [id, category.parent] : [id];
            }),
        ),
    );

    return [...byCategory.entries()]
        .filter(([categoryId]) => !alreadyBudgeted.has(categoryId))
        .map(([categoryId, total]) => {
            const category = categoryMap.get(categoryId);
            const average = Math.round(total / Math.max(1, months));
            return {
                categoryId,
                name: category?.name ?? "未分类",
                emoji: category?.emoji ?? "📦",
                color: category?.color ?? "#a8a29e",
                average,
                amount: Math.max(1000, Math.ceil(average / 1000) * 1000),
            };
        })
        .filter((item) => item.average > 0)
        .sort((a, b) => b.average - a.average)
        .slice(0, 8);
}
