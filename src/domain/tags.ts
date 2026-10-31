/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { LedgerData, Tag, TagGroup } from "@/types";

export function createDefaultTagGroups(now = Date.now()): TagGroup[] {
    return [
        {
            id: "tag_group_scene",
            name: "生活场景",
            selection: "multiple",
            createdAt: now,
        },
        {
            id: "tag_group_purpose",
            name: "费用用途",
            selection: "multiple",
            createdAt: now,
        },
        {
            id: "tag_group_people",
            name: "关联对象",
            selection: "single",
            createdAt: now,
        },
    ];
}

export function createDefaultTags(now = Date.now()): Tag[] {
    return [
        { id: "tag_daily", name: "日常", color: "#0f766e", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_work", name: "工作", color: "#3d8bfd", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_travel", name: "旅行", color: "#f59e0b", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_business", name: "出差", color: "#c084fc", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_family", name: "家庭", color: "#fb7185", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_study", name: "学习", color: "#60a5fa", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_health", name: "健康", color: "#10b981", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_entertainment", name: "娱乐", color: "#f2b84b", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_decorate", name: "装修", color: "#a8a29e", groupId: "tag_group_scene", createdAt: now },
        { id: "tag_subscription", name: "订阅", color: "#7c3aed", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_large", name: "大额", color: "#b91c1c", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_reimbursable", name: "可报销", color: "#0369a1", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_oneoff", name: "一次性", color: "#a8a29e", groupId: "tag_group_purpose", createdAt: now },
        { id: "tag_self", name: "自己", color: "#0f766e", groupId: "tag_group_people", createdAt: now },
        { id: "tag_child", name: "孩子", color: "#fb7185", groupId: "tag_group_people", createdAt: now },
        { id: "tag_parents", name: "父母", color: "#c2410c", groupId: "tag_group_people", createdAt: now },
        { id: "tag_pet", name: "宠物", color: "#b45309", groupId: "tag_group_people", createdAt: now },
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
