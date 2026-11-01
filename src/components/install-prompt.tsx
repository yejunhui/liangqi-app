/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/button";

import { t } from "@/i18n";

interface InstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "liangqi-install-dismissed";

export function InstallPrompt() {
    const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (window.matchMedia("(display-mode: standalone)").matches) {
            return;
        }
        if (window.localStorage.getItem(DISMISS_KEY) === "1") {
            return;
        }
        const onPrompt = (event: Event) => {
            event.preventDefault();
            setPromptEvent(event as InstallPromptEvent);
            setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);
        return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    }, []);

    function dismiss() {
        window.localStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
    }

    async function install() {
        if (!promptEvent) {
            return;
        }
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
            setVisible(false);
        } else {
            dismiss();
        }
        setPromptEvent(null);
    }

    if (!visible) {
        return null;
    }

    return (
        <div className="fixed bottom-24 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 shadow-xl md:bottom-6 md:right-6">
            <button
                type="button"
                onClick={dismiss}
                className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-text"
                aria-label={t("关闭安装提示")}
            >
                <X className="size-3.5" />
            </button>
            <div className="flex items-start gap-3 pr-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <Download className="size-4" />
                </span>
                <div>
                    <p className="text-xs font-bold text-text">{t("安装两讫到桌面")}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{t("像 App 一样打开，离线也能记账和查看数据。")}</p>
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={install}>{t("安装")}</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={dismiss}>{t("稍后")}</Button>
            </div>
        </div>
    );
}
