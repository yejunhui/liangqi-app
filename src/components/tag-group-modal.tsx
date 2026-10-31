/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import type { TagGroup } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

interface TagGroupModalProps {
    open: boolean;
    group: TagGroup | null;
    onClose: () => void;
}

export function TagGroupModal({ open, group, onClose }: TagGroupModalProps) {
    const addTagGroup = useLedgerStore((state) => state.addTagGroup);
    const updateTagGroup = useLedgerStore((state) => state.updateTagGroup);
    const [name, setName] = useState("");
    const [selection, setSelection] = useState<"single" | "multiple">("multiple");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setName(group?.name ?? "");
        setSelection(group?.selection ?? "multiple");
        setError("");
    }, [open, group]);

    const editing = group !== null;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!name.trim()) {
            setError("标签组名称不能为空");
            return;
        }
        const result = editing
            ? updateTagGroup(group.id, { name, selection })
            : addTagGroup({ name, selection });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(editing ? "标签组已更新" : "标签组已添加", "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "编辑标签组" : "添加标签组"}
            description="同一组标签在记账时可以选择一个或多个。"
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        取消
                    </Button>
                    <Button type="submit" form="tag-group-form" className="flex-1">
                        {editing ? "保存" : "添加标签组"}
                    </Button>
                </div>
            }
        >
            <form id="tag-group-form" className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">名称</span>
                    <input
                        className="field"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="例如：出行方式"
                        autoFocus
                    />
                </label>

                <div>
                    <p className="mb-2 text-xs font-semibold text-muted">选择方式</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: "single", label: "单选", hint: "同组只能选一个" },
                                { value: "multiple", label: "多选", hint: "同组可以选多个" },
                            ] as const
                        ).map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelection(option.value)}
                                className={cn(
                                    "rounded-xl border p-3 text-left transition",
                                    selection === option.value
                                        ? "border-accent bg-accent-soft/70"
                                        : "border-line bg-surface hover:border-line-strong",
                                )}
                            >
                                <span className="block text-xs font-semibold text-text">
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    {option.hint}
                                </span>
                            </button>
                        ))}
                    </div>
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
