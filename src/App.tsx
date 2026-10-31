/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { EntryModal } from "@/components/entry-modal";
import { ToastViewport } from "@/components/toast-viewport";
import { useApplyTheme } from "@/hooks/use-theme";
import { Dashboard } from "@/pages/dashboard";
import { Entries } from "@/pages/entries";
import { Bills } from "@/pages/bills";
import { Accounts } from "@/pages/accounts";
import { Categories } from "@/pages/categories";
import { Settings } from "@/pages/settings";

export default function App() {
    useApplyTheme();

    return (
        <HashRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="entries" element={<Entries />} />
                    <Route path="bills" element={<Bills />} />
                    <Route path="accounts" element={<Accounts />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
            <EntryModal />
            <ToastViewport />
        </HashRouter>
    );
}
