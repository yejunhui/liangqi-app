/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { createSeedData } from "@/domain/seed";
import { seedDefaultTags } from "@/domain/tags";

const NOW = new Date(2026, 9, 31, 12).getTime();

describe("default tags", () => {
    it("seeds daily tags for a new/legacy empty book", () => {
        const data = createSeedData(NOW);
        data.tags = [];
        data.tagGroups = [];
        data.settings.defaultTagsSeeded = undefined;
        const seeded = seedDefaultTags(data, NOW);
        expect(seeded.tags.length).toBeGreaterThan(10);
        expect(seeded.tagGroups.length).toBe(3);
        expect(seeded.settings.defaultTagsSeeded).toBe(true);
        expect(seeded.tags.some((tag) => tag.name === "日常")).toBe(true);
        expect(seeded.tags.some((tag) => tag.name === "旅行")).toBe(true);
    });

    it("does not re-add tags after intentional deletion", () => {
        const data = createSeedData(NOW);
        data.tags = [];
        data.tagGroups = [];
        data.settings.defaultTagsSeeded = true;
        expect(seedDefaultTags(data, NOW).tags).toHaveLength(0);
    });

    it("leaves custom tags alone and marks the book as seeded", () => {
        const data = createSeedData(NOW);
        data.tags = [
            {
                id: "tag_custom",
                name: "自定义",
                color: "#123456",
                createdAt: NOW,
            },
        ];
        data.tagGroups = [];
        data.settings.defaultTagsSeeded = undefined;
        const seeded = seedDefaultTags(data, NOW);
        expect(seeded.tags.map((tag) => tag.id)).toEqual(["tag_custom"]);
        expect(seeded.settings.defaultTagsSeeded).toBe(true);
    });
});
