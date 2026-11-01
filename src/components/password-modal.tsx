/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, LockKeyhole, ShieldOff } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/store/toast";

import { t } from "@/i18n";

export type PasswordMode = "set" | "change" | "disable";

interface PasswordModalProps {
    open: boolean;
    mode: PasswordMode;
    onClose: () => void;
}

const copy: Record<
    PasswordMode,
    { title: string; description: string; confirm: string; icon: typeof KeyRound }
> = {
    set: {
        title: t("设置本地密码"),
        description: t("至少 6 位。密码只保存在本机，不会上传。"),
        confirm: t("启用密码"),
        icon: KeyRound,
    },
    change: {
        title: t("修改本地密码"),
        description: t("先输入当前密码，再设置新密码。"),
        confirm: t("保存新密码"),
        icon: KeyRound,
    },
    disable: {
        title: t("关闭本地密码"),
        description: t("关闭后打开两讫不再需要密码。请输入当前密码确认。"),
        confirm: t("关闭密码"),
        icon: ShieldOff,
    },
};

export function PasswordModal({ open, mode, onClose }: PasswordModalProps) {
    const setPassword = useAuthStore((state) => state.setPassword);
    const changePassword = useAuthStore((state) => state.changePassword);
    const verifyPassword = useAuthStore((state) => state.verifyPassword);
    const disable = useAuthStore((state) => state.disable);

    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) {
            setCurrent("");
            setNext("");
            setConfirm("");
            setError("");
            setBusy(false);
        }
    }, [open, mode]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (mode === "disable") {
            if (!current) {
                setError(t("请输入当前密码"));
                return;
            }
            setBusy(true);
            try {
                const ok = await verifyPassword(current);
                if (!ok) {
                    setError(t("当前密码不正确"));
                    return;
                }
                disable();
                toast(t("本地密码已关闭"), "success");
                onClose();
            } finally {
                setBusy(false);
            }
            return;
        }

        if (next.length < 6) {
            setError(t("新密码至少需要 6 位"));
            return;
        }
        if (next !== confirm) {
            setError(t("两次输入的新密码不一致"));
            return;
        }

        setBusy(true);
        try {
            if (mode === "set") {
                await setPassword(next);
                toast(t("本地密码已启用"), "success");
            } else {
                await changePassword(current, next);
                toast(t("本地密码已更新"), "success");
            }
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("操作失败"));
        } finally {
            setBusy(false);
        }
    }

    const info = copy[mode];
    const Icon = info.icon;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={info.title}
            description={info.description}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button
                        type="submit"
                        form="password-form"
                        className="flex-1"
                        disabled={busy}
                    >
                        {busy ? t("处理中…") : info.confirm}
                    </Button>
                </div>
            }
        >
            <form id="password-form" className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                        <Icon className="size-4" />
                    </span>
                    <p className="text-[11px] leading-relaxed text-muted">{t("密码使用 PBKDF2-SHA256 哈希后保存在本机；两讫不会上传密码。")}</p>
                </div>

                {mode !== "set" && (
                    <PasswordField
                        label={t("当前密码")}
                        value={current}
                        onChange={setCurrent}
                        autoComplete="current-password"
                        autoFocus
                    />
                )}

                {mode !== "disable" && (
                    <>
                        <PasswordField
                            label={t("新密码")}
                            value={next}
                            onChange={setNext}
                            autoComplete="new-password"
                            autoFocus={mode === "set"}
                        />
                        <PasswordField
                            label={t("确认新密码")}
                            value={confirm}
                            onChange={setConfirm}
                            autoComplete="new-password"
                        />
                    </>
                )}

                {error && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}

                <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                    <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-accent" />{` ${t("密码只锁界面，不加密 localStorage 里的账本数据。忘记密码只能清除浏览器数据。")}`}</p>
            </form>
        </Modal>
    );
}

function PasswordField({
    label,
    value,
    onChange,
    autoComplete,
    autoFocus,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: string;
    autoFocus?: boolean;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
            <input
                type="password"
                className="field"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                placeholder={t("至少 6 位")}
            />
        </label>
    );
}
