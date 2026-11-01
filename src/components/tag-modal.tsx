/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Tag, TagGroup } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { MEMBER_COLORS } from "@/domain/members";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface TagModalProps {
    open: boolean;
    tag: Tag | null;
    groups: TagGroup[];
    defaultGroupId?: string;
    onClose: () => void;
}

export function TagModal({
    open,
    tag,
    groups,
    defaultGroupId,
    onClose,
}: TagModalProps) {
    const addTag = useLedgerStore((state) => state.addTag);
    const updateTag = useLedgerStore((state) => state.updateTag);
    const [name, setName] = useState("");
    const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
    const [groupId, setGroupId] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setName(tag?.name ?? "");
        setColor(tag?.color ?? MEMBER_COLORS[0]);
        setGroupId(tag?.groupId ?? defaultGroupId ?? "");
        setError("");
    }, [open, tag, defaultGroupId]);

    const editing = tag !== null;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!name.trim()) {
            setError(t("标签名称不能为空"));
            return;
        }
        const result = editing
            ? updateTag(tag.id, { name, color, groupId })
            : addTag({ name, color, groupId });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(editing ? t("标签已更新") : t("标签已添加"), "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? t("编辑标签") : t("添加标签")}
            description={t("标签用于跨分类标记账单，比如「旅行」「出差」「装修」。")}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="tag-form" className="flex-1">
                        {editing ? t("保存") : t("添加标签")}
                    </Button>
                </div>
            }
        >
            <form id="tag-form" className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("名称")}</span>
                    <input
                        className="field"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t("例如：旅行")}
                        autoFocus
                    />
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("标签组")}</span>
                    <select
                        className="field"
                        value={groupId}
                        onChange={(event) => setGroupId(event.target.value)}
                    >
                        <option value="">{t("未分组")}</option>
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">{t("颜色")}</p>
                    <div className="flex flex-wrap gap-2">
                        {MEMBER_COLORS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setColor(item)}
                                className={cn(
                                    "size-7 rounded-full border-2 transition",
                                    color === item
                                        ? "border-text scale-110"
                                        : "border-transparent hover:scale-105",
                                )}
                                style={{ backgroundColor: item }}
                                aria-label={t("选择颜色 {0}", [item])}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                    <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: color }}
                    />
                    <p className="text-xs font-semibold text-text">
                        {name.trim() || t("标签预览")}
                    </p>
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
