/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
    bootstrapLibrary,
    getActiveBook,
    useLibraryStore,
} from "@/store/library";
import { useLedgerStore } from "@/store/ledger";
import { getLanguage } from "@/i18n";

async function boot() {
    document.documentElement.lang = getLanguage();
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
