/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Lightweight UI translation. Chinese source strings are used as keys, so
 * untranslated strings fall back to Chinese instead of showing raw message ids.
 */

import { EN } from "@/i18n/en";

export type Language = "zh-CN" | "en-US";

const STORAGE_KEY = "liangqi-language-v1";

function detectLanguage(): Language {
    if (typeof window === "undefined") {
        return "zh-CN";
    }
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "zh-CN" || stored === "en-US") {
            return stored;
        }
    } catch {
        // Fall back to session storage or the browser language.
    }
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored === "zh-CN" || stored === "en-US") {
            return stored;
        }
    } catch {
        // Fall back to the browser language.
    }
    const browser =
        typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "zh";
    return browser.startsWith("zh") ? "zh-CN" : "en-US";
}

let currentLanguage: Language = detectLanguage();

export function getLanguage(): Language {
    return currentLanguage;
}

export function getLocale(): string {
    return currentLanguage;
}

export function setLanguage(language: Language): void {
    currentLanguage = language;
    if (typeof document !== "undefined") {
        document.documentElement.lang = language;
    }
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // The language still applies to this page view.
    }
    try {
        window.sessionStorage.setItem(STORAGE_KEY, language);
    } catch {
        // The language still applies to this page view.
    }
}

function interpolate(text: string, values?: unknown[]): string {
    if (!values || values.length === 0) {
        return text;
    }
    return text.replace(/\{(\d+)\}/g, (match, index: string) => {
        const value = values[Number(index)];
        return value === undefined ? match : String(value);
    });
}

export function t(key: string, values?: unknown[]): string {
    const text = currentLanguage === "en-US" ? (EN[key] ?? key) : key;
    return interpolate(text, values);
}

// Keep the initial document language in sync when the module is first loaded.
if (typeof document !== "undefined") {
    document.documentElement.lang = currentLanguage;
}
