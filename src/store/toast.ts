/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
    id: string;
    message: string;
    tone: ToastTone;
}

interface ToastState {
    toasts: Toast[];
    show: (message: string, tone?: ToastTone) => void;
    dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    show(message, tone = "info") {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
        window.setTimeout(() => get().dismiss(id), 3200);
    },
    dismiss(id) {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    },
}));

export function toast(message: string, tone: ToastTone = "info"): void {
    useToastStore.getState().show(message, tone);
}
