/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Member } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { MEMBER_COLORS } from "@/domain/members";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

interface MemberModalProps {
    open: boolean;
    member: Member | null;
    onClose: () => void;
}

export function MemberModal({ open, member, onClose }: MemberModalProps) {
    const addMember = useLedgerStore((state) => state.addMember);
    const updateMember = useLedgerStore((state) => state.updateMember);
    const [name, setName] = useState("");
    const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setName(member?.name ?? "");
        setColor(member?.color ?? MEMBER_COLORS[0]);
        setError("");
    }, [open, member]);

    const editing = member !== null;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!name.trim()) {
            setError("成员名称不能为空");
            return;
        }
        if (editing) {
            const result = updateMember(member.id, { name, color });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            toast("成员已更新", "success");
            onClose();
            return;
        }
        const result = addMember({ name, color });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast("成员已添加", "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "编辑成员" : "添加成员"}
            description="成员用于标记账单和流水归属，不会影响金额计算。"
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        取消
                    </Button>
                    <Button type="submit" form="member-form" className="flex-1">
                        {editing ? "保存" : "添加成员"}
                    </Button>
                </div>
            }
        >
            <form id="member-form" className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">名称</span>
                    <input
                        className="field"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="例如：爸爸、妈妈、小明"
                        autoFocus
                    />
                </label>

                <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">颜色</p>
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
                                aria-label={`选择颜色 ${item}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                    <span
                        className="grid size-10 place-items-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: color }}
                    >
                        {(name.trim() || "成").slice(0, 1)}
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-text">
                            {name.trim() || "成员预览"}
                        </p>
                        <p className="text-[10px] text-muted">账单和流水的归属成员</p>
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
