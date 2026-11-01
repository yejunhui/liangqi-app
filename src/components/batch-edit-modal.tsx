/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Entry } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { TagSelector } from "@/components/tag-selector";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface BatchEditModalProps {
    open: boolean;
    entries: Entry[];
    onClose: () => void;
}

export function BatchEditModal({ open, entries, onClose }: BatchEditModalProps) {
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tags = useLedgerStore((state) => state.tags);
    const tagGroups = useLedgerStore((state) => state.tagGroups);
    const bulkUpdateEntries = useLedgerStore((state) => state.bulkUpdateEntries);

    const [categoryId, setCategoryId] = useState("");
    const [memberId, setMemberId] = useState("");
    const [changeTags, setChangeTags] = useState(false);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setCategoryId("");
        setMemberId("");
        setChangeTags(false);
        setTagIds([]);
        setError("");
    }, [open]);

    const kinds = useMemo(
        () => [...new Set(entries.map((entry) => entry.kind))],
        [entries],
    );
    const canChangeCategory =
        kinds.length === 1 && (kinds[0] === "expense" || kinds[0] === "income");
    const categoryOptions = categories.filter((category) =>
        kinds.length === 1 ? category.kind === kinds[0] : false,
    );

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!categoryId && !memberId && !changeTags) {
            setError(t("请选择要修改的分类、成员或标签"));
            return;
        }
        const result = bulkUpdateEntries(
            entries.map((entry) => entry.id),
            {
                ...(categoryId ? { categoryId } : {}),
                ...(memberId ? { memberId } : {}),
                ...(changeTags ? { tagIds } : {}),
            },
        );
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(t("已更新 {0} 笔流水", [entries.length]), "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t("批量修改")}
            description={t("将修改选中的 {0} 笔流水；未选择的内容保持不变。", [entries.length])}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="batch-edit-form" className="flex-1">{t("保存修改")}</Button>
                </div>
            }
        >
            <form id="batch-edit-form" className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("分类")}</span>
                    <select
                        className="field"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        disabled={!canChangeCategory}
                    >
                        <option value="">{t("不修改分类")}</option>
                        {categoryOptions.map((category) => {
                            const parent = category.parent
                                ? categories.find((item) => item.id === category.parent)
                                : undefined;
                            return (
                                <option key={category.id} value={category.id}>
                                    {category.emoji} {parent ? `${parent.name} / ` : ""}
                                    {category.name}
                                </option>
                            );
                        })}
                    </select>
                    {!canChangeCategory && (
                        <span className="mt-1.5 block text-[10px] text-muted">{t("转账、还款或收支混合选择时不能批量修改分类。")}</span>
                    )}
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("成员")}</span>
                    <select
                        className="field"
                        value={memberId}
                        onChange={(event) => setMemberId(event.target.value)}
                    >
                        <option value="">{t("不修改成员")}</option>
                        {members.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div>
                    <button
                        type="button"
                        onClick={() => setChangeTags((current) => !current)}
                        className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition",
                            changeTags
                                ? "border-accent bg-accent-soft/60"
                                : "border-line bg-surface hover:border-line-strong",
                        )}
                    >
                        <span>
                            <span className="block text-xs font-semibold text-text">{t("修改标签")}</span>
                            <span className="mt-0.5 block text-[10px] text-muted">{t("替换为下面选中的标签")}</span>
                        </span>
                        <span
                            className={cn(
                                "size-4 rounded-full border",
                                changeTags
                                    ? "border-accent bg-accent"
                                    : "border-line-strong bg-surface",
                            )}
                        />
                    </button>
                    {changeTags && (
                        <div className="mt-3">
                            <TagSelector
                                tags={tags}
                                groups={tagGroups}
                                value={tagIds}
                                onChange={setTagIds}
                                label={t("新标签")}
                            />
                        </div>
                    )}
                </div>

                {error && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
}
