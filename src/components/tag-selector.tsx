/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo } from "react";
import type { Tag, TagGroup } from "@/types";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface TagSelectorProps {
    tags: Tag[];
    groups: TagGroup[];
    value: string[];
    onChange: (value: string[]) => void;
    label?: string;
}

export function TagSelector({
    tags,
    groups,
    value,
    onChange,
    label = t("标签"),
}: TagSelectorProps) {
    const grouped = useMemo(() => {
        const map = new Map<string, Tag[]>();
        for (const tag of tags) {
            const key = tag.groupId ?? "";
            const list = map.get(key) ?? [];
            list.push(tag);
            map.set(key, list);
        }
        return map;
    }, [tags]);

    function toggle(tag: Tag) {
        if (value.includes(tag.id)) {
            onChange(value.filter((id) => id !== tag.id));
            return;
        }
        if (tag.groupId) {
            const group = groups.find((item) => item.id === tag.groupId);
            if (group?.selection === "single") {
                const groupIds = new Set(
                    tags
                        .filter((item) => item.groupId === tag.groupId)
                        .map((item) => item.id),
                );
                onChange([...value.filter((id) => !groupIds.has(id)), tag.id]);
                return;
            }
        }
        onChange([...value, tag.id]);
    }

    function renderTags(list: Tag[]) {
        return (
            <div className="flex flex-wrap gap-1.5">
                {list.map((tag) => {
                    const active = value.includes(tag.id);
                    return (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggle(tag)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition",
                                active
                                    ? "border-accent bg-accent-soft text-accent"
                                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                            )}
                        >
                            <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                        </button>
                    );
                })}
            </div>
        );
    }

    const ungrouped = grouped.get("") ?? [];

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted">{label}</p>
                <span className="text-[10px] text-muted">{t("可选")}</span>
            </div>
            {tags.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-3 py-2.5 text-[11px] text-muted">{t("还没有标签，可以到「标签」页添加。")}</p>
            ) : (
                <div className="space-y-2.5">
                    {groups.map((group) => {
                        const list = grouped.get(group.id) ?? [];
                        if (list.length === 0) {
                            return null;
                        }
                        return (
                            <div key={group.id}>
                                <p className="mb-1.5 text-[10px] font-medium text-muted">
                                    {group.name}
                                    <span className="ml-1 text-muted/70">
                                        {group.selection === "single" ? t("单选") : t("多选")}
                                    </span>
                                </p>
                                {renderTags(list)}
                            </div>
                        );
                    })}
                    {ungrouped.length > 0 && (
                        <div>
                            {groups.length > 0 && (
                                <p className="mb-1.5 text-[10px] font-medium text-muted">{t("未分组")}</p>
                            )}
                            {renderTags(ungrouped)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
