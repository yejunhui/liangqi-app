/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { getLanguage, loadLanguage } from "@/i18n";

async function boot() {
    await loadLanguage(getLanguage());
    document.documentElement.lang = getLanguage();

    const { bootstrapLibrary, getActiveBook, useLibraryStore } = await import(
        "@/store/library"
    );
    const { useLedgerStore } = await import("@/store/ledger");
    const library = await bootstrapLibrary();
    useLibraryStore.setState(library);
    useLedgerStore.setState(getActiveBook(useLibraryStore.getState()));

    if (import.meta.env.PROD && "serviceWorker" in navigator) {
        navigator.serviceWorker
            .register(`${import.meta.env.BASE_URL}sw.js`)
            .catch(() => undefined);
    }

    const { default: App } = await import("./App");
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}

void boot();
