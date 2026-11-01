/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it } from "vitest";
import type { Entry } from "@/types";
import { createSeedData } from "@/domain/seed";
import { buildReportHtml } from "@/domain/reports";
import { loadLanguage, setLanguage } from "@/i18n";

const NOW = new Date(2026, 9, 31, 12).getTime();

function fixture() {
    const data = createSeedData(NOW);
    const entry: Entry = {
        id: "entry_report",
        kind: "expense",
        amount: 1_200,
        date: NOW,
        accountId: "acc_cash",
        categoryId: "cat_food",
        createdAt: NOW,
    };
    data.entries.push(entry);
    return data;
}

afterEach(async () => {
    setLanguage("zh-CN");
    await loadLanguage("zh-CN");
});

describe("report localization", () => {
    it("renders report labels in English", async () => {
        setLanguage("en-US");
        await loadLanguage("en-US");
        const data = fixture();
        const html = buildReportHtml({
            title: "Monthly report",
            periodLabel: "October 2026",
            currency: data.settings.currency,
            entries: data.entries,
            categories: data.categories,
            accounts: data.accounts,
            members: data.members,
            tags: data.tags,
        });

        expect(html).toContain('lang="en-US"');
        expect(html).toContain("Spending by category");
        expect(html).toContain("Transaction details");
        expect(html).toContain("Print / Save as PDF");
        expect(html).not.toContain("流水明细");
    });

    it("keeps report labels Chinese in Chinese mode", async () => {
        setLanguage("zh-CN");
        await loadLanguage("zh-CN");
        const data = fixture();
        const html = buildReportHtml({
            title: "月报",
            periodLabel: "2026年10月",
            currency: data.settings.currency,
            entries: data.entries,
            categories: data.categories,
            accounts: data.accounts,
            members: data.members,
            tags: data.tags,
        });

        expect(html).toContain('lang="zh-CN"');
        expect(html).toContain("流水明细");
        expect(html).toContain("分类支出");
    });
});
