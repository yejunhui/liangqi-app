/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: "sm" | "md" | "lg";
}

const sizes = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-2xl",
};

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
}: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!open) {
            return;
        }
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[3px] sm:items-center sm:p-6 animate-fade"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
                className={cn(
                    "animate-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-surface shadow-2xl sm:rounded-[1.5rem]",
                    sizes[size],
                )}
            >
                {(title || description) && (
                    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
                        <div className="min-w-0">
                            {title && (
                                <h2 id={titleId} className="text-lg font-bold tracking-tight text-text">
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-muted">
                                    {description}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                            aria-label={t("关闭")}
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

                {footer && (
                    <div className="border-t border-line bg-surface px-5 py-4 safe-bottom sm:px-6">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
