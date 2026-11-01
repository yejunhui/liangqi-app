/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getLanguage, LANGUAGES, setLanguage, t, type Language } from "@/i18n";
import { cn } from "@/utils/cn";

export function LanguageSelect({ className }: { className?: string }) {
    const language = getLanguage();
    return (
        <select
            value={language}
            aria-label={t("界面语言")}
            onChange={(event) => {
                const next = event.target.value as Language;
                if (next === language) {
                    return;
                }
                setLanguage(next);
                window.location.reload();
            }}
            className={cn(
                "rounded-lg border border-line bg-surface px-2 py-1 text-[10px] font-medium text-muted",
                className,
            )}
        >
            {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                    {item.label}
                </option>
            ))}
        </select>
    );
}
