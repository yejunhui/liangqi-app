/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getLocale, t } from "@/i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

export function endOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

export function startOfMonth(timestamp: number): number {
    const date = new Date(timestamp);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

export function endOfMonth(timestamp: number): number {
    const date = new Date(timestamp);
    date.setMonth(date.getMonth() + 1, 0);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

export function startOfYear(timestamp: number): number {
    const date = new Date(timestamp);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

export function endOfYear(timestamp: number): number {
    const date = new Date(timestamp);
    date.setMonth(11, 31);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

export function isSameMonth(a: number, b: number): boolean {
    const left = new Date(a);
    const right = new Date(b);
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function isInMonth(timestamp: number, monthTimestamp: number): boolean {
    return timestamp >= startOfMonth(monthTimestamp) && timestamp <= endOfMonth(monthTimestamp);
}

export function toDateInputValue(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function fromDateInputValue(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date.getTime();
}

export function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(getLocale(), {
        month: "long",
        day: "numeric",
    }).format(timestamp);
}

export function formatDateFull(timestamp: number): string {
    return new Intl.DateTimeFormat(getLocale(), {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(timestamp);
}

export function formatMonthLabel(timestamp: number): string {
    return new Intl.DateTimeFormat(getLocale(), {
        year: "numeric",
        month: "long",
    }).format(timestamp);
}

export function formatWeekday(timestamp: number): string {
    return new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(timestamp);
}

export function formatRelativeDay(timestamp: number, now = Date.now()): string {
    const today = startOfDay(now);
    const target = startOfDay(timestamp);
    const diff = Math.round((target - today) / DAY_MS);
    if (diff === 0) {
        return t("今天");
    }
    if (diff === -1) {
        return t("昨天");
    }
    if (diff === 1) {
        return t("明天");
    }
    return formatDate(timestamp);
}

export function daysUntil(timestamp: number, now = Date.now()): number {
    return Math.round((startOfDay(timestamp) - startOfDay(now)) / DAY_MS);
}

export function currentMonthStart(now = Date.now()): number {
    return startOfMonth(now);
}
