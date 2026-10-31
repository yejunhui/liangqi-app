/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Budget, Category, Entry } from "@/types";
import { endOfMonth, endOfYear, startOfMonth, startOfYear } from "@/utils/date";

export interface BudgetProgress {
    budget: Budget;
    spent: number;
    remaining: number;
    progress: number;
    start: number;
    end: number;
    periodLabel: string;
}

export function getBudgetRange(budget: Budget, now = Date.now()): { start: number; end: number } {
    return budget.period === "year"
        ? { start: startOfYear(now), end: endOfYear(now) }
        : { start: startOfMonth(now), end: endOfMonth(now) };
}

export function getCategoryIdsWithChildren(
    categoryIds: string[],
    categories: Category[],
): Set<string> {
    const result = new Set(categoryIds);
    for (const category of categories) {
        if (category.parent && result.has(category.parent)) {
            result.add(category.id);
        }
    }
    return result;
}

export function getBudgetSpent(
    budget: Budget,
    entries: Entry[],
    categories: Category[],
    now = Date.now(),
): number {
    const { start, end } = getBudgetRange(budget, now);
    const categoryIds =
        budget.categoryIds.length > 0
            ? getCategoryIdsWithChildren(budget.categoryIds, categories)
            : null;
    const tagIds = new Set(budget.tagIds);
    const memberIds = new Set(budget.memberIds);

    return entries
        .filter((entry) => {
            if (entry.kind !== "expense" || entry.date < start || entry.date > end) {
                return false;
            }
            if (categoryIds && (!entry.categoryId || !categoryIds.has(entry.categoryId))) {
                return false;
            }
            if (
                tagIds.size > 0 &&
                (!entry.tagIds || !entry.tagIds.some((tagId) => tagIds.has(tagId)))
            ) {
                return false;
            }
            if (memberIds.size > 0 && (!entry.memberId || !memberIds.has(entry.memberId))) {
                return false;
            }
            return true;
        })
        .reduce((total, entry) => total + entry.amount, 0);
}

export function getBudgetProgress(
    budget: Budget,
    entries: Entry[],
    categories: Category[],
    now = Date.now(),
): BudgetProgress {
    const spent = getBudgetSpent(budget, entries, categories, now);
    const { start, end } = getBudgetRange(budget, now);
    return {
        budget,
        spent,
        remaining: budget.amount - spent,
        progress: budget.amount > 0 ? spent / budget.amount : 0,
        start,
        end,
        periodLabel: budget.period === "year" ? "年度" : "月度",
    };
}

export function getBudgetProgressList(
    budgets: Budget[],
    entries: Entry[],
    categories: Category[],
    now = Date.now(),
): BudgetProgress[] {
    return budgets.map((budget) => getBudgetProgress(budget, entries, categories, now));
}
