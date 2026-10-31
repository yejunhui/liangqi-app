/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Mandatory login gate for shared ledgers. The last used member is the
 * default, but the user can switch to another member before entering the PIN.
 */

import { useEffect, useMemo, useState } from "react";
import type { Member } from "@/types";
import { Button } from "@/components/button";
import { Logo } from "@/components/logo";
import { MemberModal } from "@/components/member-modal";
import {
    hasMemberPin,
    hashMemberPin,
    validateMemberPin,
    verifyMemberPin,
} from "@/domain/member-pin";
import { useLedgerStore } from "@/store/ledger";
import {
    useActiveMember,
    useMemberSessionStore,
    useSelectedMember,
} from "@/store/member-session";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

const SWITCH_FLAG = "liangqi-member-login-list";

export function MemberLoginGate() {
    const bookId = useLedgerStore((state) => state.id);
    const bookName = useLedgerStore((state) => state.name);
    const members = useLedgerStore((state) => state.members);
    const remote = useLedgerStore((state) => state.remote);
    const updateMember = useLedgerStore((state) => state.updateMember);
    const activeMember = useActiveMember();
    const selectedMember = useSelectedMember();
    const setActiveMember = useMemberSessionStore((state) => state.setActiveMember);
    const unlockMember = useMemberSessionStore((state) => state.unlockMember);

    const [view, setView] = useState<"login" | "list">("login");
    const [targetId, setTargetId] = useState("");
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const target = useMemo(
        () =>
            members.find((member) => member.id === targetId) ??
            selectedMember,
        [members, targetId, selectedMember],
    );

    useEffect(() => {
        if (activeMember) {
            return;
        }
        const wantsList =
            typeof window !== "undefined" &&
            window.sessionStorage.getItem(SWITCH_FLAG) === "1";
        if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(SWITCH_FLAG);
        }
        setTargetId(selectedMember?.id ?? "");
        setView(wantsList ? "list" : selectedMember ? "login" : "list");
        setPin("");
        setPinConfirm("");
        setError("");
    }, [activeMember, selectedMember?.id, bookId]);

    if (!remote || activeMember) {
        return null;
    }

    function startLogin(member: Member) {
        setTargetId(member.id);
        setView("login");
        setPin("");
        setPinConfirm("");
        setError("");
    }

    async function handleLogin() {
        if (!target) {
            return;
        }
        setError("");
        if (!hasMemberPin(target)) {
            const invalid = validateMemberPin(pin);
            if (invalid) {
                setError(invalid);
                return;
            }
            if (pin !== pinConfirm) {
                setError("两次输入的 PIN 不一致");
                return;
            }
            setBusy(true);
            try {
                const fields = await hashMemberPin(pin);
                const result = updateMember(target.id, fields);
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                unlockMember(bookId, target.id);
                setActiveMember(bookId, target.id);
                toast(`已登录：${target.name}`, "success");
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : "PIN 设置失败");
            } finally {
                setBusy(false);
            }
            return;
        }
        setBusy(true);
        const valid = await verifyMemberPin(pin, target);
        setBusy(false);
        if (!valid) {
            setError("PIN 不正确");
            return;
        }
        unlockMember(bookId, target.id);
        setActiveMember(bookId, target.id);
        toast(`已登录：${target.name}`, "success");
    }

    return (
        <>
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bg/95 p-4 backdrop-blur-md">
                <div className="w-full max-w-sm rounded-[1.75rem] border border-line bg-surface p-6 shadow-2xl">
                    <div className="flex flex-col items-center text-center">
                        <Logo />
                        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                            共享账登录
                        </p>
                        <h1 className="mt-1 text-xl font-bold text-text">{bookName}</h1>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            请选择成员并输入 PIN。锁定后默认回到上次成员，也可以切换用户。
                        </p>
                    </div>

                    {view === "list" ? (
                        <div className="mt-5 space-y-2">
                            {members.length === 0 && (
                                <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-4 text-center text-[11px] text-muted">
                                    这个共享账还没有成员，先新建一个。
                                </p>
                            )}
                            {members.map((member) => (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => startLogin(member)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                        member.id === selectedMember?.id
                                            ? "border-accent/40 bg-accent-soft/30"
                                            : "border-line bg-surface-2/35 hover:border-line-strong",
                                    )}
                                >
                                    <span
                                        className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                                        style={{ backgroundColor: member.color }}
                                    >
                                        {member.name.slice(0, 1)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-text">
                                            {member.name}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] text-muted">
                                            {hasMemberPin(member)
                                                ? "输入 PIN 登录"
                                                : "首次登录，设置 PIN"}
                                        </span>
                                    </span>
                                </button>
                            ))}
                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => setCreateOpen(true)}
                            >
                                新建成员
                            </Button>
                            {target && members.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setView("login")}
                                    className="w-full py-1 text-[10px] font-medium text-muted hover:text-text"
                                >
                                    返回登录
                                </button>
                            )}
                        </div>
                    ) : target ? (
                        <form
                            className="mt-5 space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleLogin();
                            }}
                        >
                            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                                <span
                                    className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                                    style={{ backgroundColor: target.color }}
                                >
                                    {target.name.slice(0, 1)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-text">
                                        {target.name}
                                    </p>
                                    <p className="text-[10px] text-muted">
                                        {hasMemberPin(target)
                                            ? "该成员已设置 PIN"
                                            : "首次登录，请先设置 PIN"}
                                    </p>
                                </div>
                            </div>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-muted">
                                    {hasMemberPin(target) ? "成员 PIN" : "设置成员 PIN"}
                                </span>
                                <input
                                    className="field text-center text-lg tracking-[0.5em]"
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={12}
                                    value={pin}
                                    onChange={(event) => {
                                        setPin(event.target.value.replace(/\D/g, ""));
                                        setError("");
                                    }}
                                    placeholder="••••"
                                    autoFocus
                                    autoComplete="off"
                                />
                            </label>

                            {!hasMemberPin(target) && (
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
                                            setError("");
                                        }}
                                        placeholder="••••"
                                        autoComplete="off"
                                    />
                                </label>
                            )}

                            {error && (
                                <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                                    {error}
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setView("list");
                                        setPin("");
                                        setPinConfirm("");
                                        setError("");
                                    }}
                                >
                                    切换用户
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        busy ||
                                        pin.length < 4 ||
                                        (!hasMemberPin(target) && pinConfirm.length < 4)
                                    }
                                >
                                    {busy
                                        ? "登录中…"
                                        : hasMemberPin(target)
                                          ? "登录"
                                          : "设置 PIN 并登录"}
                                </Button>
                            </div>

                            <p className="text-center text-[9px] leading-relaxed text-muted">
                                PIN 哈希随成员信息保存在仓库
                            </p>
                        </form>
                    ) : (
                        <div className="mt-5">
                            <Button
                                className="w-full"
                                onClick={() => setView("list")}
                            >
                                选择成员
                            </Button>
                        </div>
                    )}

                    <p className="mt-5 text-center text-[9px] leading-relaxed text-muted">
                        同一个私钥可以由多人共用；成员身份由登录决定，而不是 token。锁定或新会话打开后需要重新登录。
                    </p>
                </div>
            </div>

            <MemberModal
                open={createOpen}
                member={null}
                onCreated={(id, createdPin) => {
                    if (createdPin) {
                        unlockMember(bookId, id);
                        setActiveMember(bookId, id);
                        toast("成员已创建并登录", "success");
                        setCreateOpen(false);
                    } else {
                        setTargetId(id);
                        setView("login");
                        setCreateOpen(false);
                    }
                }}
                onClose={() => setCreateOpen(false)}
            />
        </>
    );
}
