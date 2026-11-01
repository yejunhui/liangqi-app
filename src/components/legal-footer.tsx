/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Compact legal notice for interactive entry screens. The full notices are
 * also available from Settings and from the built app's LICENSE.txt /
 * THIRD_PARTY_NOTICES.txt files.
 */

import { cn } from "@/utils/cn";
import { t } from "@/i18n";

const GITHUB_URL = "https://github.com/yejunhui/liangqi-app";
const GITEE_URL = "https://gitee.com/PharaohMan/liangqi-app";

export function LegalFooter({ className }: { className?: string }) {
    const base = import.meta.env.BASE_URL;

    return (
        <div
            className={cn(
                "space-y-1 text-center text-[9px] leading-relaxed text-muted",
                className,
            )}
        >
            <p>© 2026 Liangqi contributors · AGPL-3.0-or-later</p>
            <p>{t("本程序不提供任何担保。你可以依据 AGPL-3.0-or-later 重新分发本程序。")}</p>
            <p>
                {`${t("源代码")}: `}
                <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                >
                    GitHub
                </a>
                {" · "}
                <a
                    href={GITEE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                >
                    Gitee
                </a>
                {" · "}
                <a
                    href={`${base}LICENSE.txt`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                >
                    {t("许可证全文")}
                </a>
                {" · "}
                <a
                    href={`${base}THIRD_PARTY_NOTICES.txt`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                >
                    {t("第三方许可")}
                </a>
            </p>
        </div>
    );
}
