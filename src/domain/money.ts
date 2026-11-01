/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Money is stored as integer cents everywhere. Never use floats for balances.
 */

import { getLocale } from "@/i18n";

export function parseAmountToCents(raw: string): number | null {
    const normalized = raw.trim().replace(/[,\s¥￥$€£]/g, "");
    if (normalized === "") {
        return null;
    }
    if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
        return null;
    }

    const [whole, fraction = ""] = normalized.split(".");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));

    if (!Number.isSafeInteger(cents) || cents < 0) {
        return null;
    }
    return cents;
}

export function formatCentsPlain(cents: number): string {
    return (cents / 100).toLocaleString(getLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function formatCents(cents: number, currency = "CNY"): string {
    try {
        return new Intl.NumberFormat(getLocale(), {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(cents / 100);
    } catch {
        return `${currency} ${formatCentsPlain(cents)}`;
    }
}

export function formatCentsSigned(cents: number, currency = "CNY"): string {
    const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
    return `${sign}${formatCents(Math.abs(cents), currency)}`;
}

export function currencySymbol(currency: string): string {
    try {
        const parts = new Intl.NumberFormat(getLocale(), {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
        }).formatToParts(0);
        return parts.find((part) => part.type === "currency")?.value ?? currency;
    } catch {
        return currency;
    }
}

export function formatPercent(value: number, digits = 0): string {
    return `${(value * 100).toFixed(digits)}%`;
}
