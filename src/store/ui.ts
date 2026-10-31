/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import type { EntryKind, EntryLocation } from "@/types";

export type ExpensePaymentMode = "asset" | "liability";

interface EntryModalOptions {
    kind?: EntryKind;
    billId?: string;
    paymentMode?: ExpensePaymentMode;
    prefill?: EntryPrefill;
}

export interface EntryPrefill {
    /** Amount in cents. */
    amount?: number;
    date?: number;
    categoryId?: string;
    assetAccountId?: string;
    liabilityAccountId?: string;
    memberId?: string;
    location?: EntryLocation;
    note?: string;
    tagIds?: string[];
}

interface UIState {
    entryModalOpen: boolean;
    entryModalKind: EntryKind;
    entryModalBillId?: string;
    entryModalPaymentMode?: ExpensePaymentMode;
    entryModalPrefill?: EntryPrefill;
    quickEntryOpen: boolean;
    bookSwitcherOpen: boolean;
    openEntryModal: (options?: EntryModalOptions) => void;
    closeEntryModal: () => void;
    openQuickEntry: () => void;
    closeQuickEntry: () => void;
    openBookSwitcher: () => void;
    closeBookSwitcher: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    entryModalOpen: false,
    entryModalKind: "expense",
    entryModalBillId: undefined,
    entryModalPaymentMode: undefined,
    entryModalPrefill: undefined,
    quickEntryOpen: false,
    bookSwitcherOpen: false,
    openEntryModal(options) {
        set({
            entryModalOpen: true,
            entryModalKind: options?.kind ?? "expense",
            entryModalBillId: options?.billId,
            entryModalPaymentMode: options?.paymentMode,
            entryModalPrefill: options?.prefill,
        });
    },
    closeEntryModal() {
        set({
            entryModalOpen: false,
            entryModalBillId: undefined,
            entryModalPaymentMode: undefined,
            entryModalPrefill: undefined,
        });
    },
    openQuickEntry() {
        set({ quickEntryOpen: true });
    },
    closeQuickEntry() {
        set({ quickEntryOpen: false });
    },
    openBookSwitcher() {
        set({ bookSwitcherOpen: true });
    },
    closeBookSwitcher() {
        set({ bookSwitcherOpen: false });
    },
}));
