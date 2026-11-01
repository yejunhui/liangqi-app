/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it } from "vitest";
import { getLanguage, loadLanguage, setLanguage, t } from "@/i18n";

afterEach(async () => {
    setLanguage("zh-CN");
    await loadLanguage("zh-CN");
});

describe("i18n", () => {
    it("keeps Chinese source text in Chinese mode", async () => {
        setLanguage("zh-CN");
        await loadLanguage("zh-CN");
        expect(getLanguage()).toBe("zh-CN");
        expect(t("设置")).toBe("设置");
        expect(t("已登录：{0}", ["Alice"])).toBe("已登录：Alice");
    });

    it("translates known UI strings and placeholders in English mode", async () => {
        setLanguage("en-US");
        await loadLanguage("en-US");
        expect(getLanguage()).toBe("en-US");
        expect(t("设置")).toBe("Settings");
        expect(t("已登录：{0}", ["Alice"])).toBe("Logged in: Alice");
    });

    it("falls back to the source string when a translation is missing", async () => {
        setLanguage("en-US");
        await loadLanguage("en-US");
        expect(t("not-a-real-key")).toBe("not-a-real-key");
    });
});
