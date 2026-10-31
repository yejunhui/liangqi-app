/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";
import { useAuthStore } from "@/store/auth";

export function AuthGate({ children }: { children: ReactNode }) {
    const enabled = useAuthStore((state) => state.enabled);
    const unlocked = useAuthStore((state) => state.unlocked);

    if (!enabled || unlocked) {
        return children;
    }
    return <LockScreen />;
}

function LockScreen() {
    const unlock = useAuthStore((state) => state.unlock);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
            const ok = await unlock(password);
            if (!ok) {
                setError("密码不正确");
                setPassword("");
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "解锁失败");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid min-h-dvh place-items-center px-4 py-10">
            <div className="w-full max-w-sm">
                <div className="mb-6 flex justify-center">
                    <Logo />
                </div>
                <form onSubmit={handleSubmit} className="card p-6">
                    <div className="flex flex-col items-center text-center">
                        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                            <LockKeyhole className="size-5" />
                        </span>
                        <h1 className="mt-4 text-xl font-bold tracking-tight text-text">
                            两讫已锁定
                        </h1>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">
                            输入本地密码继续。密码只保存在这台设备上。
                        </p>
                    </div>

                    <label className="mt-6 block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">
                            本地密码
                        </span>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="field pr-10"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoFocus
                                autoComplete="current-password"
                                placeholder="输入密码"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((value) => !value)}
                                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                            >
                                {showPassword ? (
                                    <EyeOff className="size-3.5" />
                                ) : (
                                    <Eye className="size-3.5" />
                                )}
                            </button>
                        </div>
                    </label>

                    {error && (
                        <p className="mt-3 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="mt-4 w-full"
                        disabled={busy || password.length === 0}
                    >
                        {busy ? "验证中…" : "解锁"}
                    </Button>

                    <p className="mt-4 text-center text-[10px] leading-relaxed text-muted">
                        这只保护界面访问，不会加密本机 localStorage 数据。忘记密码只能清除浏览器数据。
                    </p>
                </form>
            </div>
        </div>
    );
}
