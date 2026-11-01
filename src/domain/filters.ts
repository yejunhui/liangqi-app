/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Category, Entry } from "@/types";

export interface EntryFilter {
    categoryId?: string;
    tagId?: string;
    memberId?: string;
    accountId?: string;
    start?: number;
    end?: number;
    minAmount?: number;
    maxAmount?: number;
    keyword?: string;
}

function categoryWithChildren(categoryId: string, categories: Category[]): Set<string> {
    const ids = new Set([categoryId]);
    for (const category of categories) {
        if (category.parent === categoryId) {
            ids.add(category.id);
        }
    }
    return ids;
}

export function matchesEntryFilter(
    entry: Entry,
    filter: EntryFilter,
    categories: Category[],
): boolean {
    if (filter.categoryId) {
        const ids = categoryWithChildren(filter.categoryId, categories);
        if (!entry.categoryId || !ids.has(entry.categoryId)) {
            return false;
        }
    }
    if (filter.tagId && !(entry.tagIds ?? []).includes(filter.tagId)) {
        return false;
    }
    if (filter.memberId && entry.memberId !== filter.memberId) {
        return false;
    }
    if (
        filter.accountId &&
        entry.accountId !== filter.accountId &&
        entry.liabilityAccountId !== filter.accountId &&
        entry.toAccountId !== filter.accountId
    ) {
        return false;
    }
    if (filter.start !== undefined && entry.date < filter.start) {
        return false;
    }
    if (filter.end !== undefined && entry.date > filter.end) {
        return false;
    }
    if (filter.minAmount !== undefined && entry.amount < filter.minAmount) {
        return false;
    }
    if (filter.maxAmount !== undefined && entry.amount > filter.maxAmount) {
        return false;
    }
    if (filter.keyword) {
        const keyword = filter.keyword.trim().toLowerCase();
        if (keyword) {
            const category = categories.find((item) => item.id === entry.categoryId);
            const parent = category?.parent
                ? categories.find((item) => item.id === category.parent)
                : undefined;
            const haystack = [
                entry.note,
                category?.name,
                parent?.name,
                entry.ownerName,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(keyword)) {
                return false;
            }
        }
    }
    return true;
}

export function filterEntries(
    entries: Entry[],
    filter: EntryFilter,
    categories: Category[],
): Entry[] {
    return entries.filter((entry) => matchesEntryFilter(entry, filter, categories));
}

export function hasActiveFilter(filter: EntryFilter): boolean {
    return Object.values(filter).some(
        (value) => value !== undefined && value !== "" && value !== 0,
    );
}
