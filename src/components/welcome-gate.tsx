/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * First-run gate. A fresh browser starts with an empty local book; the shared
 * ledger only becomes available after connecting the repository. The
 * connection and active book are stored locally, so later visits go straight
 * to the member login screen.
 */

import { useState } from "react";
import {
    ArrowLeft,
    BookOpen,
    Cloud,
    LoaderCircle,
    LockKeyhole,
    RefreshCw,
} from "lucide-react";
import type {
    Connection,
    RemoteBookSummary,
    RemoteProvider,
} from "@/types";
import { Button } from "@/components/button";
import { Logo } from "@/components/logo";
import { LanguageSelect } from "@/components/language-select";
import { Tabs, type TabItem } from "@/components/tabs";
import { useLibraryStore, getActiveBook } from "@/store/library";
import { openRemoteBook, uploadCurrentBook } from "@/remote/sync";
import {
    listRemoteBooks,
    testRemoteConnection,
} from "@/remote/repository";
import { parseRepositoryInput, resolveProviderLogin } from "@/remote/repo-owner";
import { providerLabel } from "@/remote/index";
import { toast } from "@/store/toast";
import { newId } from "@/utils/id";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

const WELCOME_FLAG = "liangqi-welcome-complete-v1";

const PROVIDERS: TabItem<RemoteProvider>[] = [
    { value: "github", label: "GitHub" },
    { value: "gitee", label: "Gitee" },
    { value: "webdav", label: "WebDAV" },
];

interface FormState {
    repo: string;
    token: string;
    url: string;
    username: string;
    password: string;
}

const EMPTY_FORM: FormState = {
    repo: "",
    token: "",
    url: "",
    username: "",
    password: "",
};

function connectionToForm(target: Connection): FormState {
    return {
        repo: target.owner
            ? `${target.owner}/${target.repo ?? ""}`
            : (target.repo ?? ""),
        token: target.token ?? "",
        url: target.url ?? "",
        username: target.username ?? "",
        password: target.password ?? "",
    };
}

function readWelcomeDone(): boolean {
    if (typeof window === "undefined") {
        return true;
    }
    try {
        return window.localStorage.getItem(WELCOME_FLAG) === "1";
    } catch {
        return false;
    }
}

function writeWelcomeDone(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(WELCOME_FLAG, "1");
    } catch {
        // The current visit still works if storage is unavailable.
    }
}

export function WelcomeGate() {
    const library = useLibraryStore();
    const activeBook = getActiveBook(library);
    const lastConnection = library.connections[library.connections.length - 1];

    const [welcomeDone, setWelcomeDone] = useState(readWelcomeDone);
    const [provider, setProvider] = useState<RemoteProvider>(
        lastConnection?.provider ?? "github",
    );
    const [form, setForm] = useState<FormState>(() =>
        lastConnection ? connectionToForm(lastConnection) : EMPTY_FORM,
    );
    const [connection, setConnection] = useState<Connection | null>(
        lastConnection ?? null,
    );
    const [remoteBooks, setRemoteBooks] = useState<RemoteBookSummary[]>([]);
    const [step, setStep] = useState<"connect" | "books" | "empty">("connect");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");

    const hasRemoteBook = library.books.some((book) => book.remote);
    if (welcomeDone || hasRemoteBook || activeBook.remote) {
        return null;
    }

    function finishWelcome(): void {
        writeWelcomeDone();
        setWelcomeDone(true);
    }

    function update(field: keyof FormState, value: string): void {
        setForm((current) => ({ ...current, [field]: value }));
    }

    function resetForm(target: Connection): void {
        setProvider(target.provider);
        setForm(connectionToForm(target));
    }

    async function buildConnection(): Promise<Connection> {
        if (provider === "webdav") {
            return {
                id: newId("conn"),
                provider,
                label: form.url.trim() || "WebDAV",
                createdAt: Date.now(),
                url: form.url.trim(),
                username: form.username,
                password: form.password,
            };
        }

        const token = form.token.trim();
        if (!token) {
            throw new Error(t("请填写私钥 / Access Token"));
        }
        const repository = parseRepositoryInput(form.repo);
        if (!repository.repo) {
            throw new Error(
                t("请填写仓库名，例如 family-ledger 或 your-name/family-ledger"),
            );
        }
        let owner = repository.owner;
        if (!owner) {
            owner = await resolveProviderLogin(provider, token);
            if (!owner) {
                throw new Error(
                    t("无法从私钥识别账号，请把仓库名写成 owner/仓库名"),
                );
            }
        }
        return {
            id: newId("conn"),
            provider,
            label: `${providerLabel({ provider })} · ${owner}/${repository.repo}`,
            createdAt: Date.now(),
            owner,
            repo: repository.repo,
            branch: undefined,
            token,
            tokenKind: "pat",
        };
    }

    function findMatchingConnection(
        candidate: Connection,
    ): Connection | undefined {
        return library.connections.find((item) => {
            if (item.provider !== candidate.provider) {
                return false;
            }
            if (candidate.provider === "webdav") {
                return item.url === candidate.url;
            }
            return item.owner === candidate.owner && item.repo === candidate.repo;
        });
    }

    function persistConnection(candidate: Connection): Connection {
        const existing = findMatchingConnection(candidate);
        if (!existing) {
            useLibraryStore.getState().addConnection(candidate);
            return candidate;
        }
        const resolved = { ...candidate, id: existing.id };
        useLibraryStore.getState().updateConnection(existing.id, resolved);
        return resolved;
    }

    async function handleConnect(): Promise<void> {
        setError("");
        setBusy("connect");
        try {
            const candidate = await buildConnection();
            const tested = await testRemoteConnection(candidate);
            const resolved = persistConnection({
                ...candidate,
                branch: candidate.branch || tested.defaultBranch,
            });
            setConnection(resolved);
            resetForm(resolved);

            const books = await listRemoteBooks(resolved);
            if (books.length === 0) {
                setRemoteBooks([]);
                setStep("empty");
                return;
            }
            if (books.length === 1) {
                await openBook(resolved, books[0].id);
                return;
            }
            setRemoteBooks(books);
            setStep("books");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("连接失败"));
        } finally {
            setBusy(null);
        }
    }

    async function openBook(
        target: Connection,
        remoteBookId: string,
    ): Promise<void> {
        setError("");
        setBusy(`open:${remoteBookId}`);
        try {
            const book = await openRemoteBook(target, remoteBookId);
            finishWelcome();
            toast(t("已打开“{0}”，请选择成员登录", [book.name]), "success");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("打开共享账本失败"));
        } finally {
            setBusy(null);
        }
    }

    async function handleCreateSharedBook(): Promise<void> {
        if (!connection) {
            return;
        }
        setError("");
        setBusy("upload");
        try {
            const result = await uploadCurrentBook(connection);
            finishWelcome();
            toast(
                result.message || t("共享账本已创建，请设置成员密码"),
                "success",
            );
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("创建共享账本失败"));
        } finally {
            setBusy(null);
        }
    }

    function useLocally(): void {
        finishWelcome();
        toast(t("已进入本地账本；之后可以在「数据源」连接共享仓库"), "success");
    }

    return (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-bg/98 px-4 py-6 backdrop-blur-md">
            <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
                <div className="w-full rounded-[1.75rem] border border-line bg-surface p-6 shadow-2xl">
                    <div className="flex flex-col items-center text-center">
                        <Logo />
                        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                            {step === "connect" ? t("连接共享账本") : t("共享账本")}
                        </p>
                        <h1 className="mt-1 text-xl font-bold text-text">
                            {step === "connect"
                                ? t("先登录你的账本")
                                : step === "books"
                                  ? t("选择要打开的账本")
                                  : t("仓库还是空的")}
                        </h1>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            {step === "connect"
                                ? t("第一次使用先连接仓库。连接信息会保存在这台设备，下次打开直接选择成员登录。")
                                : step === "books"
                                  ? t("这个仓库里已经有共享账，选择一本打开后登录成员。")
                                  : t("这个仓库还没有账本，可以把当前的本地账本上传上去。")}
                        </p>
                    </div>

                    {step === "connect" && (
                        <div className="mt-5 space-y-4">
                            <Tabs
                                items={PROVIDERS}
                                value={provider}
                                onChange={(value) => {
                                    setProvider(value);
                                    setError("");
                                }}
                                className="w-full"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                                {provider === "webdav" ? (
                                    <>
                                        <div className="sm:col-span-2">
                                            <WelcomeField
                                                label={t("WebDAV 地址")}
                                                value={form.url}
                                                onChange={(value) =>
                                                    update("url", value)
                                                }
                                                placeholder="https://example.com/dav/"
                                            />
                                        </div>
                                        <WelcomeField
                                            label={t("用户名")}
                                            value={form.username}
                                            onChange={(value) =>
                                                update("username", value)
                                            }
                                            placeholder={t("WebDAV 用户名")}
                                        />
                                        <WelcomeField
                                            label={t("密码")}
                                            value={form.password}
                                            onChange={(value) =>
                                                update("password", value)
                                            }
                                            placeholder={t("WebDAV 密码")}
                                            type="password"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <WelcomeField
                                            label={t("仓库名")}
                                            value={form.repo}
                                            onChange={(value) =>
                                                update("repo", value)
                                            }
                                            placeholder="family-ledger"
                                        />
                                        <WelcomeField
                                            label={t("私钥 / Access Token")}
                                            value={form.token}
                                            onChange={(value) =>
                                                update("token", value)
                                            }
                                            placeholder={t("repo / projects 权限")}
                                            type="password"
                                        />
                                    </>
                                )}
                            </div>
                            <p className="text-[10px] leading-relaxed text-muted">{t("仓库名可以只写 repo（用私钥自动补全账号），也可以写")}{" "}
                                <code className="rounded bg-surface-2 px-1">
                                    owner/repo
                                </code>{` ${t("。一个仓库只保存一本共享账，多个人可以共用同一个私钥。")}`}</p>

                            {error && <WelcomeError>{error}</WelcomeError>}

                            <Button
                                className="w-full"
                                onClick={() => void handleConnect()}
                                disabled={busy !== null}
                            >
                                {busy === "connect" ? (
                                    <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                    <Cloud className="size-4" />
                                )}
                                {busy === "connect" ? t("连接中…") : t("连接并登录")}
                            </Button>
                            <button
                                type="button"
                                onClick={useLocally}
                                disabled={busy !== null}
                                className="w-full py-1 text-[10px] font-medium text-muted transition hover:text-text disabled:opacity-50"
                            >{t("暂不连接，仅使用本地账本")}</button>
                        </div>
                    )}

                    {step === "books" && (
                        <div className="mt-5 space-y-2">
                            {remoteBooks.map((book) => (
                                <button
                                    key={book.id}
                                    type="button"
                                    onClick={() => {
                                        if (connection) {
                                            void openBook(connection, book.id);
                                        }
                                    }}
                                    disabled={busy !== null}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/35 px-3 py-3 text-left transition",
                                        "hover:border-line-strong disabled:opacity-60",
                                    )}
                                >
                                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                                        <BookOpen className="size-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-text">
                                            {book.name}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] text-muted">
                                            {book.entryCount}{` ${t("条流水 ·")} `}{book.currency}
                                        </span>
                                    </span>
                                    {busy === `open:${book.id}` ? (
                                        <LoaderCircle className="size-4 animate-spin text-accent" />
                                    ) : (
                                        <LockKeyhole className="size-4 text-muted" />
                                    )}
                                </button>
                            ))}
                            {error && <WelcomeError>{error}</WelcomeError>}
                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => {
                                    setStep("connect");
                                    setError("");
                                }}
                                disabled={busy !== null}
                            >
                                <ArrowLeft className="size-4" />{` ${t("返回修改连接")}`}</Button>
                        </div>
                    )}

                    {step === "empty" && (
                        <div className="mt-5 space-y-3">
                            <div className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-4 text-center text-[11px] leading-relaxed text-muted">{t("连接已经成功，但仓库里还没有共享账。可以把当前本地账本上传，创建第一本共享账。")}</div>
                            {error && <WelcomeError>{error}</WelcomeError>}
                            <Button
                                className="w-full"
                                onClick={() => void handleCreateSharedBook()}
                                disabled={busy !== null}
                            >
                                {busy === "upload" ? (
                                    <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="size-4" />
                                )}
                                {busy === "upload"
                                    ? t("正在创建…")
                                    : t("在这个仓库创建共享账本")}
                            </Button>
                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => {
                                    setStep("connect");
                                    setError("");
                                }}
                                disabled={busy !== null}
                            >
                                <ArrowLeft className="size-4" />{` ${t("返回修改连接")}`}</Button>
                        </div>
                    )}

                    <p className="mt-5 text-center text-[9px] leading-relaxed text-muted">{t("私钥和连接信息只保存在本机；成员密码以 PBKDF2\n                        哈希保存在共享仓库里。")}</p>
                    <div className="mt-3 flex justify-center">
                        <LanguageSelect />
                    </div>
                </div>
            </div>
        </div>
    );
}

function WelcomeField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">
                {label}
            </span>
            <input
                type={type}
                className="field py-2 text-xs"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
        </label>
    );
}

function WelcomeError({ children }: { children: string }) {
    return (
        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {children}
        </p>
    );
}
