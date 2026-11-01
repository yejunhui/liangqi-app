/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Sparkles, Tag as TagIcon, Tags, Trash2 } from "lucide-react";
import type { Tag, TagGroup } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { TagModal } from "@/components/tag-modal";
import { TagGroupModal } from "@/components/tag-group-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

export function TagsPage() {
    const tags = useLedgerStore((state) => state.tags);
    const tagGroups = useLedgerStore((state) => state.tagGroups);
    const entries = useLedgerStore((state) => state.entries);
    const bills = useLedgerStore((state) => state.bills);
    const budgets = useLedgerStore((state) => state.budgets);
    const deleteTag = useLedgerStore((state) => state.deleteTag);
    const deleteTagGroup = useLedgerStore((state) => state.deleteTagGroup);
    const addDefaultTags = useLedgerStore((state) => state.addDefaultTags);

    const [tagModalOpen, setTagModalOpen] = useState(false);
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [defaultTagGroupId, setDefaultTagGroupId] = useState("");
    const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null);
    const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
    const [deletingGroup, setDeletingGroup] = useState<TagGroup | null>(null);

    const usage = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of entries) {
            for (const id of entry.tagIds ?? []) {
                map.set(id, (map.get(id) ?? 0) + 1);
            }
        }
        for (const bill of bills) {
            for (const id of bill.tagIds ?? []) {
                map.set(id, (map.get(id) ?? 0) + 1);
            }
        }
        for (const budget of budgets) {
            for (const id of budget.tagIds) {
                map.set(id, (map.get(id) ?? 0) + 1);
            }
        }
        return map;
    }, [entries, bills, budgets]);

    const groupedTags = useMemo(() => {
        const map = new Map<string, Tag[]>();
        for (const tag of tags) {
            const key = tag.groupId ?? "";
            const list = map.get(key) ?? [];
            list.push(tag);
            map.set(key, list);
        }
        return map;
    }, [tags]);

    function openCreateTag(groupId?: string) {
        setEditingTag(null);
        setDefaultTagGroupId(groupId ?? "");
        setTagModalOpen(true);
    }

    function handleDefaultTags() {
        const result = addDefaultTags();
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(
            result.count
                ? t("已添加 {0} 个日常标签/标签组", [result.count])
                : t("日常标签已经存在"),
            result.count ? "success" : "info",
        );
    }

    function handleDeleteTag() {
        if (!deletingTag) {
            return;
        }
        const result = deleteTag(deletingTag.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("标签已删除"), "success");
        setDeletingTag(null);
    }

    function handleDeleteGroup() {
        if (!deletingGroup) {
            return;
        }
        const result = deleteTagGroup(deletingGroup.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("标签组已删除"), "success");
        setDeletingGroup(null);
    }

    const ungrouped = groupedTags.get("") ?? [];

    return (
        <div>
            <PageHeader
                eyebrow={t("通用记账")}
                title={t("标签")}
                description={t("标签可以跨分类标记账单：旅行、出差、装修、孩子。")}
                action={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={handleDefaultTags}>
                            <Sparkles className="size-4" />{` ${t("日常标签")}`}</Button>
                        <Button variant="secondary" onClick={() => { setEditingGroup(null); setGroupModalOpen(true); }}>
                            <Tags className="size-4" />{` ${t("标签组")}`}</Button>
                        <Button onClick={() => openCreateTag()}>
                            <Plus className="size-4" />{` ${t("添加标签")}`}</Button>
                    </div>
                }
            />

            {tags.length === 0 && tagGroups.length === 0 ? (
                <EmptyState
                    icon={TagIcon}
                    title={t("还没有标签")}
                    description={t("标签适合标记跨分类的事情，比如一次旅行、一个装修项目。")}
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button size="sm" variant="secondary" onClick={handleDefaultTags}>
                                <Sparkles className="size-3.5" />{` ${t("添加日常标签")}`}</Button>
                            <Button size="sm" onClick={() => openCreateTag()}>
                                <Plus className="size-3.5" />{` ${t("添加第一个标签")}`}</Button>
                        </div>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {tagGroups.map((group) => {
                        const list = groupedTags.get(group.id) ?? [];
                        return (
                            <section key={group.id} className="card p-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">
                                            <Tags className="size-4" />
                                        </span>
                                        <div>
                                            <h2 className="text-sm font-bold text-text">
                                                {group.name}
                                            </h2>
                                            <p className="text-[10px] text-muted">
                                                {group.selection === "single" ? t("单选") : t("多选")} ·{" "}
                                                {list.length}{` ${t("个标签")}`}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openCreateTag(group.id)}
                                            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                            aria-label={t("添加标签")}
                                        >
                                            <Plus className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingGroup(group);
                                                setGroupModalOpen(true);
                                            }}
                                            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                            aria-label={t("编辑标签组")}
                                        >
                                            <Pencil className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeletingGroup(group)}
                                            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
                                            aria-label={t("删除标签组")}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                                {list.length === 0 ? (
                                    <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-4 text-center text-[11px] text-muted">{t("这个标签组还没有标签")}</p>
                                ) : (
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {list.map((tag) => (
                                            <TagCard
                                                key={tag.id}
                                                tag={tag}
                                                usage={usage.get(tag.id) ?? 0}
                                                onEdit={() => {
                                                    setEditingTag(tag);
                                                    setTagModalOpen(true);
                                                }}
                                                onDelete={() => setDeletingTag(tag)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}

                    <section className="card p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-text">{t("未分组")}</h2>
                                <p className="mt-0.5 text-[10px] text-muted">
                                    {ungrouped.length}{` ${t("个标签")}`}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => openCreateTag()}
                                className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                aria-label={t("添加标签")}
                            >
                                <Plus className="size-3.5" />
                            </button>
                        </div>
                        {ungrouped.length === 0 ? (
                            <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-4 text-center text-[11px] text-muted">{t("没有未分组标签")}</p>
                        ) : (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {ungrouped.map((tag) => (
                                    <TagCard
                                        key={tag.id}
                                        tag={tag}
                                        usage={usage.get(tag.id) ?? 0}
                                        onEdit={() => {
                                            setEditingTag(tag);
                                            setTagModalOpen(true);
                                        }}
                                        onDelete={() => setDeletingTag(tag)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <TagModal
                open={tagModalOpen}
                tag={editingTag}
                groups={tagGroups}
                defaultGroupId={defaultTagGroupId}
                onClose={() => {
                    setTagModalOpen(false);
                    setEditingTag(null);
                    setDefaultTagGroupId("");
                }}
            />
            <TagGroupModal
                open={groupModalOpen}
                group={editingGroup}
                onClose={() => {
                    setGroupModalOpen(false);
                    setEditingGroup(null);
                }}
            />
            <ConfirmDialog
                open={deletingTag !== null}
                onClose={() => setDeletingTag(null)}
                title={t("删除这个标签？")}
                description={
                    deletingTag
                        ? t("“{0}”只有在没有关联流水、账单或预算时才能删除。", [deletingTag.name])
                        : ""
                }
                confirmLabel={t("删除标签")}
                onConfirm={handleDeleteTag}
            />
            <ConfirmDialog
                open={deletingGroup !== null}
                onClose={() => setDeletingGroup(null)}
                title={t("删除这个标签组？")}
                description={
                    deletingGroup
                        ? t("“{0}”只有在没有标签时才能删除。", [deletingGroup.name])
                        : ""
                }
                confirmLabel={t("删除标签组")}
                onConfirm={handleDeleteGroup}
            />
        </div>
    );
}

function TagCard({
    tag,
    usage,
    onEdit,
    onDelete,
}: {
    tag: Tag;
    usage: number;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <article className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2/35 p-3">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-semibold text-text">{tag.name}</h3>
                <p className="mt-0.5 text-[10px] text-muted">
                    {usage > 0 ? t("{0} 处关联", [usage]) : t("还没有使用")}
                </p>
            </div>
            <div className={cn("flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100")}>
                <button
                    type="button"
                    onClick={onEdit}
                    className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                    aria-label={t("编辑标签")}
                >
                    <Pencil className="size-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
                    aria-label={t("删除标签")}
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>
        </article>
    );
}
