/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Transient remote-sync state for the current tab. It is intentionally not
 * persisted: after a reload the book's remote binding and updatedAt are enough
 * to derive whether another sync is needed.
 */

import { create } from "zustand";

export type SyncPhase = "syncing" | "success" | "error";

export interface BookSyncState {
    phase: SyncPhase;
    message?: string;
    at: number;
}

interface SyncStatusState {
    byBook: Record<string, BookSyncState>;
    setSyncing: (bookId: string) => void;
    setSuccess: (bookId: string, message?: string) => void;
    setError: (bookId: string, message: string) => void;
}

export const useSyncStatusStore = create<SyncStatusState>()((set) => ({
    byBook: {},
    setSyncing(bookId) {
        set((state) => ({
            byBook: {
                ...state.byBook,
                [bookId]: { phase: "syncing", at: Date.now() },
            },
        }));
    },
    setSuccess(bookId, message) {
        set((state) => ({
            byBook: {
                ...state.byBook,
                [bookId]: { phase: "success", message, at: Date.now() },
            },
        }));
    },
    setError(bookId, message) {
        set((state) => ({
            byBook: {
                ...state.byBook,
                [bookId]: { phase: "error", message, at: Date.now() },
            },
        }));
    },
}));
