/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useCallback, useEffect, useRef } from "react";
import { useLibraryStore } from "@/store/library";
import { useLedgerStore } from "@/store/ledger";
import { useSyncStatusStore } from "@/store/sync-status";
import { syncBookNow } from "@/remote/sync";
import { toast } from "@/store/toast";

import { t } from "@/i18n";

/**
 * Runs quietly in the background:
 * - pull when a connected book becomes active or the window regains focus
 * - push local changes after a short debounce
 * - let the remote win on conflicts and keep a local backup
 */
export function SyncManager() {
    const activeBook = useLibraryStore((state) =>
        state.books.find((book) => book.id === state.activeBookId),
    );
    const binding = activeBook?.remote;
    const bookId = activeBook?.id;
    const updatedAt = activeBook?.updatedAt;
    const syncingRef = useRef(false);
    const lastErrorAtRef = useRef(0);
    const queuedRef = useRef(false);
    const setSyncing = useSyncStatusStore((state) => state.setSyncing);
    const setSuccess = useSyncStatusStore((state) => state.setSuccess);
    const setError = useSyncStatusStore((state) => state.setError);

    const runSync = useCallback(async () => {
        if (!bookId) {
            return;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return;
        }
        if (syncingRef.current) {
            queuedRef.current = true;
            return;
        }
        syncingRef.current = true;
        setSyncing(bookId);
        try {
            const result = await syncBookNow(bookId);
            if (result.action === "local-only") {
                setError(bookId, result.message);
            } else {
                setSuccess(bookId, result.message);
            }
            if (result.action === "conflict") {
                toast(result.message, "info");
            }
            useLedgerStore.getState().postDueRecurring();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : t("远程同步失败");
            setError(bookId, message);
            const now = Date.now();
            if (now - lastErrorAtRef.current > 60_000) {
                lastErrorAtRef.current = now;
                toast(message, "error");
            }
        } finally {
            syncingRef.current = false;
            if (queuedRef.current) {
                queuedRef.current = false;
                window.setTimeout(() => {
                    void runSyncRef.current();
                }, 800);
            }
        }
    }, [bookId, setError, setSuccess, setSyncing]);

    const runSyncRef = useRef(runSync);

    useEffect(() => {
        runSyncRef.current = runSync;
    }, [runSync]);

    useEffect(() => {
        if (!bookId || !binding?.autoSync) {
            return;
        }

        let disposed = false;
        const run = () => {
            if (!disposed) {
                void runSyncRef.current();
            }
        };

        const onFocus = () => run();
        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                run();
            }
        };
        const onOnline = () => run();

        run();
        window.addEventListener("focus", onFocus);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            disposed = true;
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("online", onOnline);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [bookId, binding?.connectionId, binding?.autoSync]);

    useEffect(() => {
        if (!bookId || !binding?.autoSync || updatedAt === undefined) {
            return;
        }
        if (updatedAt <= (binding.lastSyncedAt ?? 0)) {
            return;
        }
        const timer = window.setTimeout(() => {
            void runSyncRef.current();
        }, 1800);
        return () => window.clearTimeout(timer);
    }, [bookId, updatedAt, binding?.autoSync, binding?.lastSyncedAt]);

    return null;
}
