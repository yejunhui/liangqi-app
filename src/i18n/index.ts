/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Lightweight UI translation. Chinese source strings are used as keys, so
 * untranslated strings fall back to English and then to Chinese instead of
 * showing raw message ids.
 */

export type Language =
    | "zh-CN"
    | "zh-TW"
    | "en-US"
    | "ja-JP"
    | "ko-KR"
    | "es-ES"
    | "fr-FR"
    | "de-DE"
    | "pt-BR"
    | "ru-RU";

export interface LanguageOption {
    code: Language;
    /** Native language name shown in the picker. */
    label: string;
    /** English name for search/accessibility. */
    englishName: string;
}

export const LANGUAGES: LanguageOption[] = [
    { code: "zh-CN", label: "简体中文", englishName: "Chinese (Simplified)" },
    { code: "zh-TW", label: "繁體中文", englishName: "Chinese (Traditional)" },
    { code: "en-US", label: "English", englishName: "English" },
    { code: "ja-JP", label: "日本語", englishName: "Japanese" },
    { code: "ko-KR", label: "한국어", englishName: "Korean" },
    { code: "es-ES", label: "Español", englishName: "Spanish" },
    { code: "fr-FR", label: "Français", englishName: "French" },
    { code: "de-DE", label: "Deutsch", englishName: "German" },
    { code: "pt-BR", label: "Português", englishName: "Portuguese" },
    { code: "ru-RU", label: "Русский", englishName: "Russian" },
];

const STORAGE_KEY = "liangqi-language-v1";

function detectLanguage(): Language {
    if (typeof window === "undefined") {
        return "zh-CN";
    }
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (LANGUAGES.some((item) => item.code === stored)) {
            return stored as Language;
        }
    } catch {
        // Fall back to session storage or the browser language.
    }
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (LANGUAGES.some((item) => item.code === stored)) {
            return stored as Language;
        }
    } catch {
        // Fall back to the browser language.
    }
    const browser =
        typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "zh";
    if (browser.startsWith("zh")) {
        return /(tw|hk|hant)/.test(browser) ? "zh-TW" : "zh-CN";
    }
    if (browser.startsWith("ja")) return "ja-JP";
    if (browser.startsWith("ko")) return "ko-KR";
    if (browser.startsWith("es")) return "es-ES";
    if (browser.startsWith("fr")) return "fr-FR";
    if (browser.startsWith("de")) return "de-DE";
    if (browser.startsWith("pt")) return "pt-BR";
    if (browser.startsWith("ru")) return "ru-RU";
    return "en-US";
}

let currentLanguage: Language = detectLanguage();
let messages: Record<string, string> = {};
let englishMessages: Record<string, string> = {};

const PACK_LOADERS: Record<
    Exclude<Language, "zh-CN">,
    () => Promise<Record<string, string>>
> = {
    "en-US": async () => (await import("./en")).EN,
    "zh-TW": async () => (await import("./zh-TW")).ZH_TW,
    "ja-JP": async () => (await import("./ja")).JA,
    "ko-KR": async () => (await import("./ko")).KO,
    "es-ES": async () => (await import("./es")).ES,
    "fr-FR": async () => (await import("./fr")).FR,
    "de-DE": async () => (await import("./de")).DE,
    "pt-BR": async () => (await import("./pt")).PT,
    "ru-RU": async () => (await import("./ru")).RU,
};

/** Loads the selected pack before the stores and App are imported. */
export async function loadLanguage(language: Language = currentLanguage): Promise<void> {
    currentLanguage = language;
    if (language === "zh-CN") {
        messages = {};
        englishMessages = {};
        if (typeof document !== "undefined") {
            document.documentElement.lang = language;
        }
        return;
    }

    englishMessages = {};
    try {
        englishMessages = (await import("./en")).EN;
    } catch {
        // Offline first launch: the shell can still render source strings.
    }
    if (language === "en-US") {
        messages = englishMessages;
    } else {
        try {
            messages = await PACK_LOADERS[language]();
        } catch {
            // A missing pack falls back to English rather than showing ids.
            messages = {};
        }
    }
    if (typeof document !== "undefined") {
        document.documentElement.lang = language;
    }
}

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
    const text = messages[key] ?? englishMessages[key] ?? key;
    return interpolate(text, values);
}

// Keep the initial document language in sync when the module is first loaded.
if (typeof document !== "undefined") {
    document.documentElement.lang = currentLanguage;
}
