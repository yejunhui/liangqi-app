/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect } from "react";
import { useLedgerStore } from "@/store/ledger";

export function useApplyTheme(): void {
    const theme = useLedgerStore((state) => state.settings.theme);

    useEffect(() => {
        const root = document.documentElement;
        const meta = document.querySelector('meta[name="theme-color"]');

        const apply = () => {
            const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            const dark = theme === "dark" || (theme === "system" && systemDark);
            root.classList.toggle("dark", dark);
            root.style.colorScheme = dark ? "dark" : "light";
            meta?.setAttribute("content", dark ? "#14120f" : "#f5f1e8");
        };

        apply();

        if (theme !== "system") {
            return;
        }
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", apply);
        return () => media.removeEventListener("change", apply);
    }, [theme]);
}
