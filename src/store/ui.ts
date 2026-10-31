/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import type { EntryKind } from "@/types";

export type ExpensePaymentMode = "asset" | "liability";

interface EntryModalOptions {
    kind?: EntryKind;
    billId?: string;
    paymentMode?: ExpensePaymentMode;
}

interface UIState {
    entryModalOpen: boolean;
    entryModalKind: EntryKind;
    entryModalBillId?: string;
    entryModalPaymentMode?: ExpensePaymentMode;
    bookSwitcherOpen: boolean;
    openEntryModal: (options?: EntryModalOptions) => void;
    closeEntryModal: () => void;
    openBookSwitcher: () => void;
    closeBookSwitcher: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    entryModalOpen: false,
    entryModalKind: "expense",
    entryModalBillId: undefined,
    entryModalPaymentMode: undefined,
    bookSwitcherOpen: false,
    openEntryModal(options) {
        set({
            entryModalOpen: true,
            entryModalKind: options?.kind ?? "expense",
            entryModalBillId: options?.billId,
            entryModalPaymentMode: options?.paymentMode,
        });
    },
    closeEntryModal() {
        set({ entryModalOpen: false, entryModalBillId: undefined, entryModalPaymentMode: undefined });
    },
    openBookSwitcher() {
        set({ bookSwitcherOpen: true });
    },
    closeBookSwitcher() {
        set({ bookSwitcherOpen: false });
    },
}));
