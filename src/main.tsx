import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
    bootstrapLibrary,
    getActiveBook,
    useLibraryStore,
} from "@/store/library";
import { useLedgerStore } from "@/store/ledger";

async function boot() {
    const library = await bootstrapLibrary();
    useLibraryStore.setState(library);
    useLedgerStore.setState(getActiveBook(useLibraryStore.getState()));

    const { default: App } = await import("./App");
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}

void boot();
