/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Member } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { MEMBER_COLORS } from "@/domain/members";
import {
    hasMemberPin,
    hashMemberPin,
    validateMemberPin,
} from "@/domain/member-pin";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface MemberModalProps {
    open: boolean;
    member: Member | null;
    onCreated?: (id: string, pin?: string) => void;
    onClose: () => void;
}

export function MemberModal({ open, member, onCreated, onClose }: MemberModalProps) {
    const addMember = useLedgerStore((state) => state.addMember);
    const updateMember = useLedgerStore((state) => state.updateMember);
    const remote = useLedgerStore((state) => state.remote);
    const [name, setName] = useState("");
    const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
    const [pin, setPin] = useState("");
    const [removePin, setRemovePin] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setName(member?.name ?? "");
        setColor(member?.color ?? MEMBER_COLORS[0]);
        setPin("");
        setRemovePin(false);
        setError("");
    }, [open, member]);

    const editing = member !== null;
    const existingPin = member !== null && hasMemberPin(member);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!name.trim()) {
            setError(t("成员名称不能为空"));
            return;
        }
        if (remote && !pin.trim() && (!editing || !existingPin)) {
            setError(t("共享账本的成员必须设置密码"));
            return;
        }
        if (remote && removePin) {
            setError(t("共享账本的成员不能清除密码"));
            return;
        }
        const pinValue = pin.trim();
        if (pinValue) {
            const invalid = validateMemberPin(pinValue);
            if (invalid) {
                setError(invalid);
                return;
            }
        }
        let pinFields:
            | {
                  pinHash?: string;
                  pinSalt?: string;
                  pinIterations?: number;
              }
            | undefined;
        try {
            if (pinValue) {
                pinFields = await hashMemberPin(pinValue);
            } else if (removePin) {
                pinFields = {
                    pinHash: undefined,
                    pinSalt: undefined,
                    pinIterations: undefined,
                };
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("密码处理失败"));
            return;
        }

        if (editing) {
            const result = updateMember(member.id, {
                name,
                color,
                ...(pinFields ?? {}),
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            toast(t("成员已更新"), "success");
            onClose();
            return;
        }
        const result = addMember({ name, color, ...(pinFields ?? {}) });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        if (result.id) {
            onCreated?.(result.id, pinValue || undefined);
        }
        toast(t("成员已添加"), "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? t("编辑成员") : t("添加成员")}
            description={t("成员用于标记账单和流水归属，不会影响金额计算。")}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="member-form" className="flex-1">
                        {editing ? t("保存") : t("添加成员")}
                    </Button>
                </div>
            }
        >
            <form id="member-form" className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("名称")}</span>
                    <input
                        className="field"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t("例如：爸爸、妈妈、小明")}
                        autoFocus
                    />
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

                <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-semibold text-text">{t("成员密码")}</p>
                            <p className="mt-0.5 text-[10px] text-muted">
                                {remote
                                    ? t("共享账本必须设置密码；4–32 位，可包含字母和数字")
                                    : t("可选，4–32 位；切换成员时需要输入")}
                            </p>
                        </div>
                        {existingPin && !removePin && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPin("");
                                    setRemovePin(true);
                                }}
                                className="text-[10px] font-medium text-danger hover:underline"
                            >{t("清除密码")}</button>
                        )}
                    </div>
                    {removePin ? (
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-danger-soft/50 px-2.5 py-2">
                            <span className="text-[10px] text-danger">{t("保存后会清除已有密码")}</span>
                            <button
                                type="button"
                                onClick={() => setRemovePin(false)}
                                className="text-[10px] font-medium text-text hover:underline"
                            >{t("取消")}</button>
                        </div>
                    ) : (
                        <input
                            className="field mt-2 text-xs tracking-widest"
                            type="password"
                            maxLength={32}
                            value={pin}
                            onChange={(event) => setPin(event.target.value)}
                            placeholder={
                                existingPin
                                    ? t("留空保持现有密码，输入新密码可修改")
                                    : t("设置成员密码（可选）")
                            }
                            autoComplete="new-password"
                        />
                    )}
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                    <span
                        className="grid size-10 place-items-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: color }}
                    >
                        {(name.trim() || t("成")).slice(0, 1)}
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-text">
                            {name.trim() || t("成员预览")}
                        </p>
                        <p className="text-[10px] text-muted">{t("账单和流水的归属成员")}</p>
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
