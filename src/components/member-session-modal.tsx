/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import type { Member } from "@/types";
import { Check, LockKeyhole, Plus, UserRound, Users } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { MemberModal } from "@/components/member-modal";
import { hasMemberPin, hashMemberPin, validateMemberPin, verifyMemberPin } from "@/domain/member-pin";
import { useLedgerStore } from "@/store/ledger";
import {
    useActiveMember,
    useMemberSessionStore,
    useSelectedMember,
} from "@/store/member-session";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

export function MemberSessionModal() {
    const open = useUIStore((state) => state.memberModalOpen);
    const close = useUIStore((state) => state.closeMemberModal);
    const bookId = useLedgerStore((state) => state.id);
    const bookName = useLedgerStore((state) => state.name);
    const members = useLedgerStore((state) => state.members);
    const remote = useLedgerStore((state) => state.remote);
    const updateMember = useLedgerStore((state) => state.updateMember);
    const activeMember = useActiveMember();
    const selectedMember = useSelectedMember();
    const setActiveMember = useMemberSessionStore((state) => state.setActiveMember);
    const unlockMember = useMemberSessionStore((state) => state.unlockMember);
    const lockMember = useMemberSessionStore((state) => state.lockMember);
    const unlocked = useMemberSessionStore((state) => state.unlocked);
    const [createOpen, setCreateOpen] = useState(false);
    const [pending, setPending] = useState<Member | null>(null);
    const [pendingMode, setPendingMode] = useState<"verify" | "setup">("verify");
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [pinError, setPinError] = useState("");
    const [verifying, setVerifying] = useState(false);

    const ordered = useMemo(
        () =>
            [...members].sort((a, b) => {
                if (a.id === (activeMember?.id ?? selectedMember?.id)) {
                    return -1;
                }
                if (b.id === (activeMember?.id ?? selectedMember?.id)) {
                    return 1;
                }
                return a.createdAt - b.createdAt;
            }),
        [members, activeMember?.id, selectedMember?.id],
    );

    function resetPending() {
        setPending(null);
        setPin("");
        setPinConfirm("");
        setPinError("");
        setVerifying(false);
    }

    function choose(member: Member) {
        if (!remote) {
            setActiveMember(bookId, member.id);
            toast(`当前记账成员：${member.name}`, "success");
            close();
            return;
        }
        if (hasMemberPin(member)) {
            if (unlocked[`${bookId}:${member.id}`]) {
                setActiveMember(bookId, member.id);
                toast(`当前记账成员：${member.name}`, "success");
                close();
                return;
            }
            setPending(member);
            setPendingMode("verify");
            setPin("");
            setPinConfirm("");
            setPinError("");
            return;
        }
        setPending(member);
        setPendingMode("setup");
        setPin("");
        setPinConfirm("");
        setPinError("");
    }

    async function confirmPin() {
        if (!pending) {
            return;
        }
        setVerifying(true);
        setPinError("");
        if (pendingMode === "setup") {
            const invalid = validateMemberPin(pin);
            if (invalid) {
                setPinError(invalid);
                setVerifying(false);
                return;
            }
            if (pin !== pinConfirm) {
                setPinError("两次输入的 PIN 不一致");
                setVerifying(false);
                return;
            }
            try {
                const fields = await hashMemberPin(pin);
                const result = updateMember(pending.id, fields);
                if (!result.ok) {
                    setPinError(result.error);
                    setVerifying(false);
                    return;
                }
                unlockMember(bookId, pending.id);
                setActiveMember(bookId, pending.id);
                toast(`已为 ${pending.name} 设置 PIN，并登录`, "success");
                resetPending();
                close();
            } catch (error) {
                setPinError(error instanceof Error ? error.message : "PIN 设置失败");
            } finally {
                setVerifying(false);
            }
            return;
        }
        const valid = await verifyMemberPin(pin, pending);
        setVerifying(false);
        if (!valid) {
            setPinError("PIN 不正确");
            return;
        }
        unlockMember(bookId, pending.id);
        setActiveMember(bookId, pending.id);
        toast(`当前记账成员：${pending.name}`, "success");
        resetPending();
        close();
    }

    function handleClose() {
        resetPending();
        close();
    }

    return (
        <>
            <Modal
                open={open}
                onClose={handleClose}
                title={
                    pending
                        ? pendingMode === "setup"
                            ? "设置成员 PIN"
                            : "输入成员 PIN"
                        : "选择我的成员"
                }
                description={
                    pending
                        ? pendingMode === "setup"
                            ? `共享账本的“${pending.name}”还没有 PIN，先设置后再登录。`
                            : `切换到“${pending.name}”需要验证成员 PIN。`
                        : "同一个仓库可以由多人使用；选择你登录的成员后，新流水会记在这个成员名下。"
                }
                size="sm"
                footer={
                    pending ? (
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={resetPending}
                            >
                                返回
                            </Button>
                            <Button
                                type="submit"
                                form="member-pin-form"
                                className="flex-1"
                                disabled={
                                    verifying ||
                                    pin.length < 4 ||
                                    (pendingMode === "setup" && pinConfirm.length < 4)
                                }
                            >
                                {verifying
                                    ? "处理中…"
                                    : pendingMode === "setup"
                                      ? "设置 PIN 并登录"
                                      : "确认登录"}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus className="size-3.5" />
                                新建成员
                            </Button>
                            <Button className="flex-1" onClick={handleClose}>
                                关闭
                            </Button>
                        </div>
                    )
                }
            >
                {pending ? (
                    <form
                        id="member-pin-form"
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void confirmPin();
                        }}
                    >
                        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                            <span
                                className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                                style={{ backgroundColor: pending.color }}
                            >
                                {pending.name.slice(0, 1)}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-text">
                                    {pending.name}
                                </p>
                                <p className="text-[10px] text-muted">
                                    {pendingMode === "setup"
                                        ? "共享账本需要 PIN 来区分成员"
                                        : "PIN 已设置，验证后才能在该成员名下记账"}
                                </p>
                            </div>
                        </div>
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-muted">
                                成员 PIN
                            </span>
                            <input
                                className="field text-center text-lg tracking-[0.5em]"
                                type="password"
                                inputMode="numeric"
                                maxLength={12}
                                value={pin}
                                onChange={(event) => {
                                    setPin(event.target.value.replace(/\D/g, ""));
                                    setPinError("");
                                }}
                                placeholder="••••"
                                autoFocus
                                autoComplete="off"
                            />
                        </label>
                        {pendingMode === "setup" && (
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-muted">
                                    再输一次 PIN
                                </span>
                                <input
                                    className="field text-center text-lg tracking-[0.5em]"
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={12}
                                    value={pinConfirm}
                                    onChange={(event) => {
                                        setPinConfirm(
                                            event.target.value.replace(/\D/g, ""),
                                        );
                                        setPinError("");
                                    }}
                                    placeholder="••••"
                                    autoComplete="off"
                                />
                            </label>
                        )}
                        {pinError && (
                            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                                {pinError}
                            </p>
                        )}
                        <p className="text-[10px] leading-relaxed text-muted">
                            成员 PIN 使用 PBKDF2 哈希后随成员信息保存在仓库中，仓库里不会出现明文 PIN。
                        </p>
                    </form>
                ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft/45 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-surface">
                            {(activeMember ?? selectedMember)?.name.slice(0, 1) ?? "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium text-muted">
                                当前账本：{bookName}
                            </p>
                            <p className="truncate text-xs font-bold text-text">
                                {activeMember
                                    ? `当前成员 · ${activeMember.name}`
                                    : selectedMember
                                      ? `已选择 · ${selectedMember.name}（待验证）`
                                      : "还没有选择成员"}
                            </p>
                        </div>
                        {activeMember && remote && (
                            <button
                                type="button"
                                onClick={() => {
                                    lockMember(bookId, activeMember.id);
                                    toast("已锁定当前成员", "success");
                                    close();
                                }}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[10px] font-medium text-muted transition hover:text-text"
                            >
                                <LockKeyhole className="size-3" />
                                锁定
                            </button>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        {ordered.map((member) => {
                            const active = member.id === activeMember?.id;
                            const selected =
                                !active && member.id === selectedMember?.id;
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => choose(member)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                        active
                                            ? "border-accent bg-accent-soft/60"
                                            : selected
                                              ? "border-accent/40 bg-accent-soft/25"
                                              : "border-line bg-surface hover:border-line-strong",
                                    )}
                                >
                                    <span
                                        className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                                        style={{ backgroundColor: member.color }}
                                    >
                                        {member.name.slice(0, 1)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-text">
                                            {member.name}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] text-muted">
                                            {active
                                                ? "当前登录成员"
                                                : selected
                                                  ? "已选择 · 需要 PIN 验证"
                                                  : remote && !hasMemberPin(member)
                                                    ? "未设置 PIN，点击设置"
                                                    : hasMemberPin(member)
                                                      ? "点击并输入 PIN"
                                                      : "选择这个成员"}
                                        </span>
                                    </span>
                                    {hasMemberPin(member) && (
                                        <LockKeyhole className="size-3.5 shrink-0 text-muted" />
                                    )}
                                    {active && <Check className="size-4 shrink-0 text-accent" />}
                                </button>
                            );
                        })}
                    </div>

                    {members.length === 0 && (
                        <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-4 text-center text-[11px] text-muted">
                            还没有成员，先新建一个。
                        </p>
                    )}

                    <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
                        <Users className="mt-0.5 size-3 shrink-0 text-accent" />
                        成员列表会随账本同步到仓库。其他人连接同一个仓库后，可以选择自己的成员登录；每条记账会记录作者，别人只能查看，不能修改你的记录。
                    </p>
                    <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
                        <UserRound className="mt-0.5 size-3 shrink-0 text-muted" />
                        同一个私钥可以被多人使用；身份由这里选择的成员决定，而不是 token。
                    </p>
                </div>
                )}
            </Modal>

            <MemberModal
                open={createOpen}
                member={null}
                onCreated={(id, pin) => {
                    if (remote && pin) {
                        unlockMember(bookId, id);
                    }
                    setActiveMember(bookId, id);
                    toast("成员已创建，并设为当前记账成员", "success");
                    setCreateOpen(false);
                    close();
                }}
                onClose={() => setCreateOpen(false)}
            />
        </>
    );
}
