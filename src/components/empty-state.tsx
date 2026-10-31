/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center",
                className,
            )}
        >
            <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
                <Icon className="size-5" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-text">{title}</h3>
            {description && (
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
