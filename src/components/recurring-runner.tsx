/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from "react";
import { useLedgerStore } from "@/store/ledger";
import { useLibraryStore } from "@/store/library";

/**
 * Posts due recurring entries for local-only books. Books with auto sync are
 * handled by SyncManager after the remote pull, so we don't duplicate entries.
 */
export function RecurringRunner() {
    const bookId = useLibraryStore((state) => state.activeBookId);
    const autoSync = useLibraryStore((state) => {
        const book = state.books.find((item) => item.id === state.activeBookId);
        return book?.remote?.autoSync ?? false;
    });

    useEffect(() => {
        if (autoSync) {
            return;
        }
        const timer = window.setTimeout(() => {
            useLedgerStore.getState().postDueRecurring();
        }, 1200);
        return () => window.clearTimeout(timer);
    }, [bookId, autoSync]);

    return null;
}
