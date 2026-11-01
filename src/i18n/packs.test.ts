/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { EN } from "@/i18n/en";
import { JA } from "@/i18n/ja";
import { KO } from "@/i18n/ko";
import { ES } from "@/i18n/es";
import { FR } from "@/i18n/fr";
import { DE } from "@/i18n/de";
import { PT } from "@/i18n/pt";
import { RU } from "@/i18n/ru";
import { ZH_TW } from "@/i18n/zh-TW";

const PACKS: Array<[string, Record<string, string>]> = [
    ["ja", JA],
    ["ko", KO],
    ["es", ES],
    ["fr", FR],
    ["de", DE],
    ["pt", PT],
    ["ru", RU],
    ["zh-TW", ZH_TW],
];

function placeholders(value: string): string {
    return [...value.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort().join(",");
}

describe("language packs", () => {
    it.each(PACKS)("%s contains every source key and placeholder", (_, pack) => {
        expect(Object.keys(pack).sort()).toEqual(Object.keys(EN).sort());
        for (const [key, value] of Object.entries(pack)) {
            expect(value.trim().length).toBeGreaterThan(0);
            expect(placeholders(value)).toBe(placeholders(key));
        }
    });
});
