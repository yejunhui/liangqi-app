/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { RecurringRule } from "@/types";
import {
    advanceRecurringDate,
    getDueOccurrences,
    getNextRecurringDate,
} from "@/domain/recurring";

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
    const start = new Date(2026, 0, 31, 9, 0, 0).getTime();
    return {
        id: "r1",
        name: "房租",
        kind: "expense",
        amount: 300_000,
        frequency: "monthly",
        interval: 1,
        startDate: start,
        nextDueDate: start,
        enabled: true,
        categoryId: "cat_food",
        accountId: "acc_cash",
        createdAt: start,
        ...overrides,
    };
}

describe("recurring dates", () => {
    it("keeps the anchor day when a month is shorter", () => {
        const base = new Date(2026, 0, 31, 9).getTime();
        const feb = advanceRecurringDate(base, rule());
        expect(new Date(feb).getDate()).toBe(28);
        expect(new Date(feb).getMonth()).toBe(1);
        const mar = advanceRecurringDate(feb, rule());
        expect(new Date(mar).getDate()).toBe(31);
        expect(new Date(mar).getMonth()).toBe(2);
    });

    it("advances weeks and years", () => {
        const weekly = rule({ frequency: "weekly", interval: 2 });
        const base = new Date(2026, 0, 31, 9).getTime();
        const next = advanceRecurringDate(base, weekly);
        expect(new Date(next).getTime() - base).toBe(14 * 86_400_000);

        const yearly = rule({ frequency: "yearly" });
        const nextYear = advanceRecurringDate(base, yearly);
        expect(new Date(nextYear).getFullYear()).toBe(2027);
        expect(new Date(nextYear).getMonth()).toBe(0);
        expect(new Date(nextYear).getDate()).toBe(31);
    });

    it("returns due occurrences up to now and respects end dates", () => {
        const start = new Date(2026, 0, 1, 9).getTime();
        const now = new Date(2026, 2, 15, 12).getTime();
        const monthly = rule({ startDate: start, nextDueDate: start });
        expect(getDueOccurrences(monthly, now)).toHaveLength(3);
        expect(getNextRecurringDate(monthly, now)).toBe(
            new Date(2026, 3, 1, 9).getTime(),
        );

        const ended = rule({
            startDate: start,
            nextDueDate: start,
            endDate: new Date(2026, 1, 1, 9).getTime(),
        });
        expect(getDueOccurrences(ended, now)).toHaveLength(2);
    });

    it("ignores paused rules", () => {
        const paused = rule({ enabled: false });
        expect(getDueOccurrences(paused, Date.now())).toEqual([]);
    });
});
