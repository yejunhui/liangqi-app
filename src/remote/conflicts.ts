/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Book, ConflictBackup } from "@/types";
import { newId } from "@/utils/id";

const CONFLICTS_KEY = "liangqi-conflicts-v1";
const MAX_CONFLICTS = 10;

export function getConflictBackups(): ConflictBackup[] {
    if (typeof window === "undefined") {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(CONFLICTS_KEY);
        if (!raw) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(
            (item): item is ConflictBackup =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as ConflictBackup).id === "string" &&
                typeof (item as ConflictBackup).bookId === "string" &&
                typeof (item as ConflictBackup).savedAt === "number" &&
                typeof (item as ConflictBackup).book === "object",
        );
    } catch {
        return [];
    }
}

export function saveConflictBackup(book: Book): ConflictBackup | null {
    if (typeof window === "undefined") {
        return null;
    }
    const backup: ConflictBackup = {
        id: newId("conflict"),
        bookId: book.id,
        name: book.name,
        savedAt: Date.now(),
        book,
    };
    try {
        const existing = getConflictBackups();
        const next = [backup, ...existing].slice(0, MAX_CONFLICTS);
        window.localStorage.setItem(CONFLICTS_KEY, JSON.stringify(next));
        return backup;
    } catch {
        return null;
    }
}

export function clearConflictBackups(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.removeItem(CONFLICTS_KEY);
    } catch {
        // Ignore storage failures.
    }
}
