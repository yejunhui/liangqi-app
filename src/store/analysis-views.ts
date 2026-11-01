/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { create } from "zustand";
import type { EntryFilter } from "@/domain/filters";
import { newId } from "@/utils/id";

import { t } from "@/i18n";

const VIEWS_KEY = "liangqi-analysis-views-v1";

export interface AnalysisView {
    id: string;
    name: string;
    filter: EntryFilter;
    createdAt: number;
}

type ViewMap = Record<string, AnalysisView[]>;

function readViews(): ViewMap {
    if (typeof window === "undefined") {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(VIEWS_KEY);
        if (!raw) {
            return {};
        }
        const value: unknown = JSON.parse(raw);
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return {};
        }
        return value as ViewMap;
    } catch {
        return {};
    }
}

function writeViews(value: ViewMap): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(VIEWS_KEY, JSON.stringify(value));
    } catch {
        // Views are optional; keep them in memory for this session.
    }
}

interface AnalysisViewState {
    byBook: ViewMap;
    addView: (bookId: string, name: string, filter: EntryFilter) => string;
    deleteView: (bookId: string, viewId: string) => void;
}

export const useAnalysisViewStore = create<AnalysisViewState>()((set) => ({
    byBook: readViews(),
    addView(bookId, name, filter) {
        const view: AnalysisView = {
            id: newId("view"),
            name: name.trim() || t("分析视图"),
            filter,
            createdAt: Date.now(),
        };
        const current = useAnalysisViewStore.getState().byBook;
        const next = {
            ...current,
            [bookId]: [...(current[bookId] ?? []), view].slice(-50),
        };
        writeViews(next);
        set({ byBook: next });
        return view.id;
    },
    deleteView(bookId, viewId) {
        const current = useAnalysisViewStore.getState().byBook;
        const next = {
            ...current,
            [bookId]: (current[bookId] ?? []).filter((view) => view.id !== viewId),
        };
        writeViews(next);
        set({ byBook: next });
    },
}));
