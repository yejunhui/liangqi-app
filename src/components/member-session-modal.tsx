/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
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

import { t } from "@/i18n";

export function MemberSessionModal() {
    const open = useUIStore((state) => state.memberModalOpen);
    const close = useUIStore((state) => state.closeMemberModal);
    const bookId = useLedgerStore((state) => state.id);
    const bookName = useLedgerStore((state) => state.name);
    const remote = useLedgerStore((state) => state.remote);
    const members = useLedgerStore((state) => state.members);
    const activeMember = useActiveMember();
    const lockMember = useMemberSessionStore((state) => state.lockMember);
    const requiresPassword = Boolean(remote) || members.length > 1;

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
        lockAndClose(t("已退出当前成员，请重新登录"));
    }

    return (
        <Modal
            open={open}
            onClose={close}
            title={t("当前记账成员")}
            description={t("多成员账本和共享账本的成员身份决定当前记账成员。")}
            size="sm"
            footer={
                <Button className="w-full" onClick={close}>{t("关闭")}</Button>
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
                            <ShieldCheck className="size-3" />{` ${t("已登录，新流水会记在这个成员名下")}`}</p>
                    </div>
                </div>

                {requiresPassword && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" onClick={switchUser}>
                            <ArrowLeftRight className="size-3.5" />{` ${t("切换用户")}`}</Button>
                        <Button
                            variant="secondary"
                            onClick={() => lockAndClose(t("已锁定，请重新登录"))}
                        >
                            <LockKeyhole className="size-3.5" />{` ${t("锁定")}`}</Button>
                    </div>
                )}

                {requiresPassword && (
                    <p className="text-[10px] leading-relaxed text-muted">{t("「切换用户」和「锁定」都会退出当前成员并回到登录页的成员列表。上次登录的成员排在第一位，也可以选择其他成员，再输入密码登录。")}</p>
                )}
                {!requiresPassword && (
                    <p className="text-[10px] leading-relaxed text-muted">{t("单成员本地账本无需成员密码；添加第二个成员后会启用成员密码登录。")}</p>
                )}
            </div>
        </Modal>
    );
}
