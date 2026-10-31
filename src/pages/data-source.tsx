/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Cloud,
    Download,
    FolderOpen,
    HardDrive,
    KeyRound,
    RefreshCw,
    Server,
    ShieldCheck,
    Trash2,
    Unplug,
    Upload,
} from "lucide-react";
import type {
    ConflictBackup,
    Connection,
    RemoteBookSummary,
    RemoteProvider,
} from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { Tabs, type TabItem } from "@/components/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import {
    getActiveBook,
    getConnectionById,
    useLibraryStore,
} from "@/store/library";
import { setActiveBookRemote } from "@/store/book-actions";
import { toast } from "@/store/toast";
import { downloadJson } from "@/utils/download";
import { formatRelativeDay } from "@/utils/date";
import { newId } from "@/utils/id";
import {
    openRemoteBook,
    syncBookNow,
    uploadCurrentBook,
    disconnectBook,
} from "@/remote/sync";
import { listRemoteBooks, testRemoteConnection } from "@/remote/repository";
import { providerLabel } from "@/remote/index";
import { startOAuth } from "@/remote/oauth";
import {
    clearConflictBackups,
    getConflictBackups,
} from "@/remote/conflicts";
import { createExportPayload } from "@/domain/backup";
import { cn } from "@/utils/cn";

interface FormState {
    owner: string;
    repo: string;
    branch: string;
    token: string;
    oauthBase: string;
    url: string;
    username: string;
    password: string;
}

const EMPTY_FORM: FormState = {
    owner: "",
    repo: "",
    branch: "",
    token: "",
    oauthBase: "",
    url: "",
    username: "",
    password: "",
};

const PROVIDERS: TabItem<RemoteProvider>[] = [
    { value: "github", label: "GitHub" },
    { value: "gitee", label: "Gitee" },
    { value: "webdav", label: "WebDAV" },
];

export function DataSource() {
    const library = useLibraryStore();
    const activeBook = getActiveBook(library);
    const binding = activeBook.remote;
    const boundConnection = binding
        ? getConnectionById(library, binding.connectionId)
        : undefined;

    const [provider, setProvider] = useState<RemoteProvider>("github");
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [connection, setConnection] = useState<Connection | null>(null);
    const [remoteBooks, setRemoteBooks] = useState<RemoteBookSummary[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [disconnectOpen, setDisconnectOpen] = useState(false);
    const [conflicts, setConflicts] = useState<ConflictBackup[]>(() =>
        getConflictBackups(),
    );
    const [autoSync, setAutoSync] = useState(binding?.autoSync ?? true);

    useEffect(() => {
        setAutoSync(binding?.autoSync ?? true);
    }, [binding?.autoSync]);

    useEffect(() => {
        if (!boundConnection) {
            return;
        }
        applyConnection(boundConnection);
    }, [boundConnection]);

    useEffect(() => {
        if (boundConnection || connection) {
            return;
        }
        const recent = library.connections[library.connections.length - 1];
        if (recent) {
            applyConnection(recent);
        }
    }, [boundConnection, connection, library.connections]);

    function applyConnection(target: Connection) {
        setConnection(target);
        setProvider(target.provider);
        setForm((current) => ({
            ...current,
            owner: target.owner ?? "",
            repo: target.repo ?? "",
            branch: target.branch ?? "",
            token: target.token ?? "",
            url: target.url ?? "",
            username: target.username ?? "",
            password: target.password ?? "",
        }));
        listRemoteBooks(target)
            .then(setRemoteBooks)
            .catch(() => {
                // A missing/unreadable index should not block the page.
            });
    }

    function update(field: keyof FormState, value: string) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    function buildConnection(): Connection {
        const id = connection?.id ?? newId("conn");
        const label =
            provider === "webdav"
                ? form.url.trim() || "WebDAV"
                : `${providerLabel({ provider })} · ${form.owner.trim()}/${form.repo.trim()}`;
        return {
            id,
            provider,
            label,
            createdAt: connection?.createdAt ?? Date.now(),
            owner: provider === "webdav" ? undefined : form.owner.trim(),
            repo: provider === "webdav" ? undefined : form.repo.trim(),
            branch:
                provider === "webdav" ? undefined : form.branch.trim() || undefined,
            token: provider === "webdav" ? undefined : form.token.trim(),
            tokenKind: "pat",
            url: provider === "webdav" ? form.url.trim() : undefined,
            username: provider === "webdav" ? form.username : undefined,
            password: provider === "webdav" ? form.password : undefined,
        };
    }

    function findMatchingConnection(candidate: Connection): Connection | undefined {
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

    async function handleConnect() {
        setError("");
        setBusy("connect");
        try {
            const candidate = buildConnection();
            const tested = await testRemoteConnection(candidate);
            const resolved: Connection = {
                ...candidate,
                branch: candidate.branch || tested.defaultBranch,
            };
            const existing = findMatchingConnection(resolved);
            if (existing) {
                useLibraryStore.getState().updateConnection(existing.id, resolved);
                resolved.id = existing.id;
            } else {
                useLibraryStore.getState().addConnection(resolved);
            }
            setConnection(resolved);
            const books = await listRemoteBooks(resolved);
            setRemoteBooks(books);
            toast(
                books.length > 0
                    ? `连接成功，仓库里有 ${books.length} 个账本`
                    : "连接成功，仓库里还没有账本",
                "success",
            );
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "连接失败");
        } finally {
            setBusy(null);
        }
    }

    async function handleOAuth() {
        if (provider === "webdav") {
            return;
        }
        setError("");
        setBusy("oauth");
        try {
            const token = await startOAuth(provider, form.oauthBase);
            update("token", token);
            toast("授权成功，点击“测试并读取账本”继续", "success");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "OAuth 登录失败");
        } finally {
            setBusy(null);
        }
    }

    async function handleUploadCurrent() {
        if (!connection) {
            setError("请先连接远程仓库");
            return;
        }
        setError("");
        setBusy("upload");
        try {
            const result = await uploadCurrentBook(connection);
            toast(result.message, result.action === "conflict" ? "info" : "success");
            setRemoteBooks(await listRemoteBooks(connection));
            setConflicts(getConflictBackups());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "上传失败");
        } finally {
            setBusy(null);
        }
    }

    async function handleOpenRemote(remoteBookId: string) {
        if (!connection) {
            return;
        }
        setError("");
        setBusy(`open:${remoteBookId}`);
        try {
            const book = await openRemoteBook(connection, remoteBookId);
            toast(`已打开“${book.name}”`, "success");
            setConflicts(getConflictBackups());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "打开远程账本失败");
        } finally {
            setBusy(null);
        }
    }

    async function handleSync() {
        setError("");
        setBusy("sync");
        try {
            const result = await syncBookNow(activeBook.id);
            toast(result.message, result.action === "conflict" ? "info" : "success");
            setConflicts(getConflictBackups());
            if (connection) {
                setRemoteBooks(await listRemoteBooks(connection));
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "同步失败");
        } finally {
            setBusy(null);
        }
    }

    function toggleAutoSync() {
        if (!binding) {
            return;
        }
        const next = !binding.autoSync;
        setActiveBookRemote(activeBook.id, { ...binding, autoSync: next });
        setAutoSync(next);
        toast(next ? "已开启自动同步" : "已关闭自动同步", "success");
    }

    function handleDisconnect() {
        disconnectBook(activeBook.id);
        setConnection(null);
        setRemoteBooks([]);
        setDisconnectOpen(false);
        toast("已断开当前账本的远程连接，本地数据保留", "success");
    }

    function downloadConflict(backup: ConflictBackup) {
        downloadJson(
            `liangqi-conflict-${backup.book.name}-${backup.savedAt}.json`,
            createExportPayload(backup.book),
        );
    }

    function handleClearConflicts() {
        clearConflictBackups();
        setConflicts([]);
        toast("冲突备份已清空", "success");
    }

    const isWebDav = provider === "webdav";
    const currentRemoteBook = binding
        ? remoteBooks.find((book) => book.id === binding.remoteBookId)
        : undefined;

    return (
        <div>
            <PageHeader
                eyebrow="本地优先"
                title="数据源"
                description="默认只保存在本机；连接 GitHub、Gitee 或 WebDAV 后，一个仓库可以放多个账本。已连接时优先使用远程数据，离线自动回退本地。"
            />

            <section className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                            <HardDrive className="size-5" />
                        </span>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-sm font-bold text-text">
                                    当前账本：{activeBook.name}
                                </h2>
                                <span
                                    className={cn(
                                        "chip",
                                        binding
                                            ? "bg-accent-soft text-accent"
                                            : "bg-surface-3 text-muted",
                                    )}
                                >
                                    {binding ? "已连接远程" : "仅本地"}
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted">
                                {binding && boundConnection
                                    ? `${providerLabel(boundConnection)} · ${
                                          boundConnection.owner
                                              ? `${boundConnection.owner}/${boundConnection.repo}`
                                              : boundConnection.url
                                      } · 远程账本 ${binding.remoteBookId}`
                                    : "数据只保存在这个浏览器里。连接远程后，家庭设备之间可以共享同一个账本。"}
                            </p>
                        </div>
                    </div>

                    {binding && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={toggleAutoSync}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                                    autoSync
                                        ? "border-accent bg-accent-soft text-accent"
                                        : "border-line bg-surface text-muted",
                                )}
                            >
                                <span
                                    className={cn(
                                        "relative h-4 w-7 rounded-full transition",
                                        autoSync ? "bg-accent" : "bg-surface-3",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute top-0.5 size-3 rounded-full bg-surface transition-all",
                                            autoSync ? "left-3.5" : "left-0.5",
                                        )}
                                    />
                                </span>
                                自动同步
                            </button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleSync}
                                disabled={busy !== null}
                            >
                                <RefreshCw
                                    className={cn(
                                        "size-3.5",
                                        busy === "sync" && "animate-spin",
                                    )}
                                />
                                立即同步
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDisconnectOpen(true)}
                            >
                                <Unplug className="size-3.5" />
                                断开
                            </Button>
                        </div>
                    )}
                </div>

                {binding && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <InfoCell
                            label="远程账本"
                            value={currentRemoteBook?.name ?? binding.remoteBookId}
                        />
                        <InfoCell
                            label="上次同步"
                            value={
                                binding.lastSyncedAt
                                    ? formatRelativeDay(binding.lastSyncedAt)
                                    : "尚未同步"
                            }
                        />
                        <InfoCell
                            label="远程流水"
                            value={
                                currentRemoteBook
                                    ? `${currentRemoteBook.entryCount} 笔`
                                    : "读取中"
                            }
                        />
                    </div>
                )}
            </section>

            <section className="card mt-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-text">连接远程仓库</h2>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            连接后会读取仓库里的{" "}
                            <code className="rounded bg-surface-2 px-1 py-0.5">
                                liangqi/index.json
                            </code>
                            ，列出所有账本供你选择。
                        </p>
                    </div>
                </div>

                <Tabs
                    items={PROVIDERS}
                    value={provider}
                    onChange={setProvider}
                    className="mt-4"
                />

                {library.connections.length > 0 && (
                    <div className="mt-4 rounded-xl border border-line bg-surface-2/35 p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                            已保存连接
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {library.connections.map((saved) => {
                                const active = connection?.id === saved.id;
                                return (
                                    <button
                                        key={saved.id}
                                        type="button"
                                        onClick={() => applyConnection(saved)}
                                        className={cn(
                                            "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition",
                                            active
                                                ? "border-accent bg-accent-soft text-accent"
                                                : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                                        )}
                                    >
                                        <Cloud className="size-3 shrink-0" />
                                        <span className="truncate">{saved.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {!isWebDav ? (
                        <>
                            <Field
                                label="仓库 owner"
                                value={form.owner}
                                onChange={(value) => update("owner", value)}
                                placeholder="例如：your-name"
                            />
                            <Field
                                label="仓库名"
                                value={form.repo}
                                onChange={(value) => update("repo", value)}
                                placeholder="例如：family-ledger"
                            />
                            <Field
                                label="分支（可选）"
                                value={form.branch}
                                onChange={(value) => update("branch", value)}
                                placeholder="留空自动使用默认分支"
                            />
                            <Field
                                label="Access Token"
                                value={form.token}
                                onChange={(value) => update("token", value)}
                                placeholder="repo / projects 读写权限"
                                type="password"
                            />
                        </>
                    ) : (
                        <>
                            <div className="sm:col-span-2">
                                <Field
                                    label="WebDAV 地址"
                                    value={form.url}
                                    onChange={(value) => update("url", value)}
                                    placeholder="https://dav.example.com/remote.php/dav/files/me/"
                                />
                            </div>
                            <Field
                                label="用户名"
                                value={form.username}
                                onChange={(value) => update("username", value)}
                                placeholder="WebDAV 用户名"
                            />
                            <Field
                                label="密码"
                                value={form.password}
                                onChange={(value) => update("password", value)}
                                placeholder="WebDAV 密码"
                                type="password"
                            />
                        </>
                    )}
                </div>

                {!isWebDav && (
                    <div className="mt-4 rounded-xl border border-line bg-surface-2/45 p-3.5">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-text">
                            <KeyRound className="size-3.5 text-accent" />
                            使用 OAuth 登录（可选）
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted">
                            需要先部署{" "}
                            <code className="rounded bg-surface px-1">
                                server/oauth-worker
                            </code>
                            。PAT 和 OAuth 二选一即可。
                        </p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                                className="field py-2 text-xs"
                                value={form.oauthBase}
                                onChange={(event) => update("oauthBase", event.target.value)}
                                placeholder="OAuth 服务地址，例如 https://liangqi-oauth.example.workers.dev"
                            />
                            <Button
                                size="sm"
                                variant="secondary"
                                className="shrink-0 whitespace-nowrap"
                                onClick={handleOAuth}
                                disabled={busy !== null}
                            >
                                <Cloud className="size-3.5" />
                                {provider === "github" ? "GitHub" : "Gitee"} 登录
                            </Button>
                        </div>
                    </div>
                )}

                {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-danger">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {error}
                    </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button onClick={handleConnect} disabled={busy !== null}>
                        <Server className="size-3.5" />
                        {busy === "connect" ? "连接中…" : "测试并读取账本"}
                    </Button>
                    {connection && (
                        <span className="flex items-center gap-1 text-[10px] text-success">
                            <CheckCircle2 className="size-3" />
                            已连接，可读取仓库账本
                        </span>
                    )}
                </div>

                <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
                    Token / 密码只保存在本机 localStorage，不会经过两讫的服务器。建议使用只授权单个仓库的细粒度 token。
                </p>

                {isWebDav && (
                    <p className="mt-2 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-liability" />
                        WebDAV 服务器需要允许浏览器跨域访问（CORS）。如果连接失败，先在服务器配置 CORS，或换用 GitHub / Gitee。
                    </p>
                )}
            </section>

            <section className="card mt-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-text">仓库里的账本</h2>
                        <p className="mt-1 text-[11px] text-muted">
                            一个仓库可以放多个账本。打开远程账本会把它复制到本地并切换过去。
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleUploadCurrent}
                        disabled={busy !== null || !connection}
                    >
                        <Upload className="size-3.5" />
                        上传当前账本
                    </Button>
                </div>

                {remoteBooks.length === 0 ? (
                    <EmptyState
                        icon={FolderOpen}
                        title={connection ? "仓库里还没有账本" : "先连接一个远程仓库"}
                        description={
                            connection
                                ? "把当前账本上传上去，或从其他设备上传后再回来选择。"
                                : "连接 GitHub、Gitee 或 WebDAV 后，这里会列出仓库里的账本。"
                        }
                        className="mt-4 border-0 bg-transparent"
                    />
                ) : (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {remoteBooks.map((book) => {
                            const isCurrent = binding?.remoteBookId === book.id;
                            return (
                                <div
                                    key={book.id}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl border p-3.5",
                                        isCurrent
                                            ? "border-accent bg-accent-soft/40"
                                            : "border-line bg-surface-2/35",
                                    )}
                                >
                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                                        <FolderOpen className="size-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <p className="truncate text-xs font-semibold text-text">
                                                {book.name}
                                            </p>
                                            {isCurrent && (
                                                <span className="chip bg-accent text-surface">
                                                    当前
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-[10px] text-muted">
                                            {book.entryCount} 笔流水 · {book.currency} · 更新于{" "}
                                            {formatRelativeDay(book.updatedAt)}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={isCurrent ? "secondary" : "primary"}
                                        onClick={() => handleOpenRemote(book.id)}
                                        disabled={busy !== null}
                                    >
                                        {busy === `open:${book.id}`
                                            ? "打开中…"
                                            : isCurrent
                                              ? "重新拉取"
                                              : "打开"}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="card mt-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-text">冲突备份</h2>
                        <p className="mt-1 text-[11px] text-muted">
                            远程优先覆盖本地时，被覆盖的版本会保存在这里。最多保留 10 份。
                        </p>
                    </div>
                    {conflicts.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={handleClearConflicts}>
                            <Trash2 className="size-3.5" />
                            清空
                        </Button>
                    )}
                </div>

                {conflicts.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-5 text-center text-[11px] text-muted">
                        还没有冲突备份。
                    </p>
                ) : (
                    <div className="mt-4 space-y-2">
                        {conflicts.map((backup) => (
                            <div
                                key={backup.id}
                                className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/35 p-3"
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger">
                                    <AlertTriangle className="size-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-text">
                                        {backup.name}
                                    </p>
                                    <p className="text-[10px] text-muted">
                                        {formatRelativeDay(backup.savedAt)} ·{" "}
                                        {backup.book.entries.length} 笔流水
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => downloadConflict(backup)}
                                >
                                    <Download className="size-3.5" />
                                    下载
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={disconnectOpen}
                onClose={() => setDisconnectOpen(false)}
                title="断开远程连接？"
                description="本地数据会保留，但这个账本将不再自动同步。远程仓库里的数据不会被删除。"
                confirmLabel="断开连接"
                onConfirm={handleDisconnect}
            />
        </div>
    );
}

function Field({
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
            <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
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

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-line bg-surface-2/55 px-3 py-2.5">
            <p className="text-[10px] text-muted">{label}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-text">{value}</p>
        </div>
    );
}
