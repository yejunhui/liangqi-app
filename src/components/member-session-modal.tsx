/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { Check, Plus, UserRound, Users } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { MemberModal } from "@/components/member-modal";
import { useLedgerStore } from "@/store/ledger";
import {
    useActiveMember,
    useMemberSessionStore,
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
    const activeMember = useActiveMember();
    const setActiveMember = useMemberSessionStore((state) => state.setActiveMember);
    const [createOpen, setCreateOpen] = useState(false);

    const ordered = useMemo(
        () =>
            [...members].sort((a, b) => {
                if (a.id === activeMember?.id) {
                    return -1;
                }
                if (b.id === activeMember?.id) {
                    return 1;
                }
                return a.createdAt - b.createdAt;
            }),
        [members, activeMember?.id],
    );

    function choose(memberId: string, name: string) {
        setActiveMember(bookId, memberId);
        toast(`当前记账成员：${name}`, "success");
        close();
    }

    return (
        <>
            <Modal
                open={open}
                onClose={close}
                title="选择我的成员"
                description="同一个仓库可以由多人使用；选择你登录的成员后，新流水会记在这个成员名下。"
                size="sm"
                footer={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="size-3.5" />
                            新建成员
                        </Button>
                        <Button className="flex-1" onClick={close}>
                            关闭
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft/45 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-surface">
                            {activeMember?.name.slice(0, 1) ?? "?"}
                        </span>
                        <div className="min-w-0">
                            <p className="text-[10px] font-medium text-muted">
                                当前账本：{bookName}
                            </p>
                            <p className="truncate text-xs font-bold text-text">
                                {activeMember
                                    ? `当前成员 · ${activeMember.name}`
                                    : "还没有选择成员"}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {ordered.map((member) => {
                            const active = member.id === activeMember?.id;
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => choose(member.id, member.name)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                        active
                                            ? "border-accent bg-accent-soft/60"
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
                                            {active ? "当前登录成员" : "选择这个成员"}
                                        </span>
                                    </span>
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
            </Modal>

            <MemberModal
                open={createOpen}
                member={null}
                onCreated={(id) => {
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
