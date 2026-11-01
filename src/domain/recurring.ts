/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RecurringFrequency, RecurringRule } from "@/types";

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
    daily: "天",
    weekly: "周",
    monthly: "月",
    yearly: "年",
};

export function frequencyLabel(rule: RecurringRule): string {
    if (rule.interval === 1) {
        return rule.frequency === "daily"
            ? "每天"
            : rule.frequency === "weekly"
              ? "每周"
              : rule.frequency === "monthly"
                ? "每月"
                : "每年";
    }
    return `每 ${rule.interval} ${FREQUENCY_LABELS[rule.frequency]}`;
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Advances one occurrence. Monthly / yearly rules keep the anchor day from
 * startDate so Jan 31 → Feb 28 → Mar 31 instead of drifting to Mar 28.
 */
export function advanceRecurringDate(
    date: number,
    rule: Pick<RecurringRule, "frequency" | "interval" | "startDate">,
): number {
    const current = new Date(date);
    const anchor = new Date(rule.startDate);
    const interval = Math.max(1, Math.floor(rule.interval));

    if (rule.frequency === "daily" || rule.frequency === "weekly") {
        const days = rule.frequency === "daily" ? 1 : 7;
        const next = new Date(current);
        next.setDate(next.getDate() + days * interval);
        return next.getTime();
    }

    if (rule.frequency === "monthly") {
        const target = new Date(current);
        target.setDate(1);
        target.setMonth(target.getMonth() + interval);
        const day = Math.min(anchor.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
        target.setDate(day);
        return target.getTime();
    }

    const target = new Date(current);
    const month = anchor.getMonth();
    target.setDate(1);
    target.setFullYear(target.getFullYear() + interval, month, 1);
    const day = Math.min(anchor.getDate(), daysInMonth(target.getFullYear(), month));
    target.setDate(day);
    return target.getTime();
}

export function getDueOccurrences(rule: RecurringRule, now = Date.now()): number[] {
    if (!rule.enabled) {
        return [];
    }
    const dates: number[] = [];
    let next = rule.nextDueDate;
    let guard = 0;
    while (next <= now && guard < 500) {
        if (rule.endDate !== undefined && next > rule.endDate) {
            break;
        }
        dates.push(next);
        next = advanceRecurringDate(next, rule);
        guard += 1;
    }
    return dates;
}

export function getNextRecurringDate(rule: RecurringRule, now = Date.now()): number | undefined {
    const due = getDueOccurrences(rule, now);
    if (due.length > 0) {
        return advanceRecurringDate(
            due[due.length - 1],
            rule,
        );
    }
    if (rule.endDate !== undefined && rule.nextDueDate > rule.endDate) {
        return undefined;
    }
    return rule.nextDueDate;
}
