/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef } from "react";
import { useLibraryStore } from "@/store/library";
import { syncBookNow } from "@/remote/sync";
import { toast } from "@/store/toast";

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

    useEffect(() => {
        if (!bookId || !binding?.autoSync) {
            return;
        }

        let disposed = false;

        const run = async () => {
            if (disposed) {
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
            try {
                const result = await syncBookNow(bookId);
                if (result.action === "conflict") {
                    toast(result.message, "info");
                }
            } catch (error) {
                const now = Date.now();
                if (now - lastErrorAtRef.current > 60_000) {
                    lastErrorAtRef.current = now;
                    toast(
                        error instanceof Error ? error.message : "远程同步失败",
                        "error",
                    );
                }
            } finally {
                syncingRef.current = false;
                if (queuedRef.current) {
                    queuedRef.current = false;
                    window.setTimeout(run, 800);
                }
            }
        };

        const onFocus = () => {
            void run();
        };
        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                void run();
            }
        };
        const onOnline = () => {
            void run();
        };

        void run();
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
            if (syncingRef.current) {
                queuedRef.current = true;
                return;
            }
            void syncBookNow(bookId).catch((error: unknown) => {
                const now = Date.now();
                if (now - lastErrorAtRef.current > 60_000) {
                    lastErrorAtRef.current = now;
                    toast(
                        error instanceof Error ? error.message : "远程同步失败",
                        "error",
                    );
                }
            });
        }, 1800);
        return () => window.clearTimeout(timer);
    }, [bookId, updatedAt, binding?.autoSync, binding?.lastSyncedAt]);

    return null;
}
