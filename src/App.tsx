/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { EntryModal } from "@/components/entry-modal";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { ToastViewport } from "@/components/toast-viewport";
import { InstallPrompt } from "@/components/install-prompt";
import { SyncManager } from "@/components/sync-manager";
import { RecurringRunner } from "@/components/recurring-runner";
import { AuthGate } from "@/components/auth-gate";
import { useApplyTheme } from "@/hooks/use-theme";
import { Dashboard } from "@/pages/dashboard";
import { Entries } from "@/pages/entries";
import { Bills } from "@/pages/bills";
import { Accounts } from "@/pages/accounts";
import { Categories } from "@/pages/categories";
import { TagsPage } from "@/pages/tags";
import { Budgets } from "@/pages/budgets";
import { Recurring } from "@/pages/recurring";
import { CsvImport } from "@/pages/csv-import";
import { Analytics } from "@/pages/analytics";
import { Settings } from "@/pages/settings";
import { DataSource } from "@/pages/data-source";
import { Members } from "@/pages/members";

export default function App() {
    useApplyTheme();

    return (
        <AuthGate>
            <HashRouter>
                <Routes>
                    <Route element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="entries" element={<Entries />} />
                        <Route path="bills" element={<Bills />} />
                        <Route path="accounts" element={<Accounts />} />
                        <Route path="categories" element={<Categories />} />
                        <Route path="tags" element={<TagsPage />} />
                        <Route path="budgets" element={<Budgets />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="recurring" element={<Recurring />} />
                        <Route path="import" element={<CsvImport />} />
                        <Route path="members" element={<Members />} />
                        <Route path="data" element={<DataSource />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
                <SyncManager />
                <RecurringRunner />
                <EntryModal />
                <QuickEntryModal />
                <InstallPrompt />
                <ToastViewport />
            </HashRouter>
        </AuthGate>
    );
}
