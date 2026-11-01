/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { LedgerData, Tag, TagGroup } from "@/types";

import { t } from "@/i18n";

export function createDefaultTagGroups(now = Date.now()): TagGroup[] {
    return [
        {
            id: "tag_group_scene",
            name: t("生活场景"),
            selection: "multiple",
            createdAt: now,
        },
        {
            id: "tag_group_purpose",
            name: t("费用用途"),
            selection: "multiple",
            createdAt: now,
        },
        {
            id: "tag_group_people",
            name: t("关联对象"),
            selection: "single",
            createdAt: now,
        },
    ];
}

export function createDefaultTags(now = Date.now()): Tag[] {
    return [
        { id: "tag_daily", name: t("日常"), color: "#0f766e", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_work", name: t("工作"), color: "#3d8bfd", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_travel", name: t("旅行"), color: "#f59e0b", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_business", name: t("出差"), color: "#c084fc", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_family", name: t("家庭"), color: "#fb7185", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_study", name: t("学习"), color: "#60a5fa", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_health", name: t("健康"), color: "#10b981", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_entertainment", name: t("娱乐"), color: "#f2b84b", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_decorate", name: t("装修"), color: "#a8a29e", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_subscription", name: t("订阅"), color: "#7c3aed", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_large", name: t("大额"), color: "#b91c1c", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_reimbursable", name: t("可报销"), color: "#0369a1", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_oneoff", name: t("一次性"), color: "#a8a29e", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_self", name: t("自己"), color: "#0f766e", groupId: "tag_group_people", createdAt: now },
        { id: "tag_child", name: t("孩子"), color: "#fb7185", groupId: "tag_group_people", createdAt: now },
        { id: "tag_parents", name: t("父母"), color: "#c2410c", groupId: "tag_group_people", createdAt: now },
        { id: "tag_pet", name: t("宠物"), color: "#b45309", groupId: "tag_group_people", createdAt: now },
    ];
}

/**
 * Adds starter tags once per book. A book that already has any custom tag or
 * group is marked as seeded, so deleting all tags later does not re-add them.
 */
export function seedDefaultTags<T extends LedgerData>(
    data: T,
    now = Date.now(),
): T {
    if (data.settings.defaultTagsSeeded === true) {
        return data;
    }
    if (data.tags.length > 0 || data.tagGroups.length > 0) {
        return {
            ...data,
            settings: { ...data.settings, defaultTagsSeeded: true },
        };
    }
    return {
        ...data,
        tagGroups: createDefaultTagGroups(now),
        tags: createDefaultTags(now),
        settings: { ...data.settings, defaultTagsSeeded: true },
    };
}
