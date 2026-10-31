/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ArrowLeftRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { useLedgerStore } from "@/store/ledger";
import {
    useActiveMember,
    useMemberSessionStore,
} from "@/store/member-session";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";

export function MemberSessionModal() {
    const open = useUIStore((state) => state.memberModalOpen);
    const close = useUIStore((state) => state.closeMemberModal);
    const bookId = useLedgerStore((state) => state.id);
    const bookName = useLedgerStore((state) => state.name);
    const remote = useLedgerStore((state) => state.remote);
    const activeMember = useActiveMember();
    const lockMember = useMemberSessionStore((state) => state.lockMember);

    if (!open || !activeMember) {
        return null;
    }

    function lockAndClose(message: string) {
        if (!activeMember) {
            return;
        }
        lockMember(bookId, activeMember.id);
        toast(message, "success");
        close();
    }

    function switchUser() {
        lockAndClose("已退出当前成员，请重新登录");
    }

    return (
        <Modal
            open={open}
            onClose={close}
            title="当前记账成员"
            description="共享账本的成员身份决定记账作者；同一个私钥可以由多人共用。"
            size="sm"
            footer={
                <Button className="w-full" onClick={close}>
                    关闭
                </Button>
            }
        >
            <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft/45 p-4">
                    <span
                        className="grid size-11 shrink-0 place-items-center rounded-full text-base font-bold text-white"
                        style={{ backgroundColor: activeMember.color }}
                    >
                        {activeMember.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-muted">
                            {bookName}
                        </p>
                        <p className="truncate text-sm font-bold text-text">
                            {activeMember.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-success">
                            <ShieldCheck className="size-3" />
                            已登录，新流水会记在这个成员名下
                        </p>
                    </div>
                </div>

                {remote && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" onClick={switchUser}>
                            <ArrowLeftRight className="size-3.5" />
                            切换用户
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => lockAndClose("已锁定，请重新登录")}
                        >
                            <LockKeyhole className="size-3.5" />
                            锁定
                        </Button>
                    </div>
                )}

                {remote && (
                    <p className="text-[10px] leading-relaxed text-muted">
                        「切换用户」和「锁定」都会退出当前成员并回到登录页的成员列表。上次登录的成员排在第一位，也可以选择其他成员，再输入密码登录。
                    </p>
                )}
                {!remote && (
                    <p className="text-[10px] leading-relaxed text-muted">
                        本地账本没有共享成员登录限制；连接远程仓库后会启用成员密码登录。
                    </p>
                )}
            </div>
        </Modal>
    );
}
