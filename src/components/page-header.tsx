/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    eyebrow?: string;
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
                {eyebrow && (
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</h1>
                {description && (
                    <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
                )}
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}
