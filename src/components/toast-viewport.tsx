/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

const toneStyles = {
    success: "border-success/25 bg-success-soft text-success",
    error: "border-danger/25 bg-danger-soft text-danger",
    info: "border-line bg-surface text-text",
};

const toneIcons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
};

export function ToastViewport() {
    const toasts = useToastStore((state) => state.toasts);
    const dismiss = useToastStore((state) => state.dismiss);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end">
            {toasts.map((toast) => {
                const Icon = toneIcons[toast.tone];
                return (
                    <div
                        key={toast.id}
                        className={cn(
                            "animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-card",
                            toneStyles[toast.tone],
                        )}
                    >
                        <Icon className="mt-0.5 size-4 shrink-0" />
                        <p className="flex-1 text-xs font-medium leading-relaxed">{t(toast.message)}</p>
                        <button
                            type="button"
                            onClick={() => dismiss(toast.id)}
                            className="rounded p-0.5 opacity-60 transition hover:opacity-100"
                            aria-label={t("关闭提示")}
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
