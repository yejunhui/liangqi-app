/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { formatCents } from "@/domain/money";
import { cn } from "@/utils/cn";

interface MoneyProps {
    value: number;
    currency: string;
    sign?: "positive" | "negative" | "none";
    className?: string;
}

export function Money({ value, currency, sign = "none", className }: MoneyProps) {
    const prefix = sign === "negative" ? "−" : sign === "positive" ? "+" : "";
    return (
        <span className={cn("tabular-nums", className)}>
            {prefix}
            {formatCents(value, currency)}
        </span>
    );
}
