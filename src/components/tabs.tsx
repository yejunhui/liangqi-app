/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { cn } from "@/utils/cn";

export interface TabItem<T extends string> {
    value: T;
    label: string;
    count?: number;
}

interface TabsProps<T extends string> {
    items: TabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
    return (
        <div
            role="tablist"
            className={cn(
                "inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2/70 p-1",
                className,
            )}
        >
            {items.map((item) => {
                const active = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                            active
                                ? "bg-surface text-text shadow-sm"
                                : "text-muted hover:text-text",
                        )}
                    >
                        {item.label}
                        {item.count !== undefined && (
                            <span
                                className={cn(
                                    "ml-1.5 tabular-nums",
                                    active ? "text-accent" : "text-muted/70",
                                )}
                            >
                                {item.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
