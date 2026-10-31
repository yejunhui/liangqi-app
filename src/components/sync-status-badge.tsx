/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Cloud,
    CloudAlert,
    CloudCheck,
    CloudOff,
    CloudUpload,
} from "lucide-react";
import { getActiveBook, useLibraryStore } from "@/store/library";
import { useSyncStatusStore } from "@/store/sync-status";
import { cn } from "@/utils/cn";

type SyncVisualKind =
    | "local"
    | "disabled"
    | "offline"
    | "syncing"
    | "error"
    | "pending"
    | "synced";

interface SyncVisual {
    kind: SyncVisualKind;
    label: string;
    title: string;
    icon: typeof Cloud;
    className: string;
    dotClassName: string;
}

function useOnlineStatus(): boolean {
    const [online, setOnline] = useState(() =>
        typeof navigator === "undefined" ? true : navigator.onLine,
    );

    useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    return online;
}

function lastSyncText(timestamp?: number): string {
    if (!timestamp) {
        return "还没有同步记录";
    }
    return `上次同步：${new Date(timestamp).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

export function SyncStatusBadge() {
    const book = useLibraryStore((state) => getActiveBook(state));
    const remote = book?.remote;
    const live = useSyncStatusStore((state) =>
        book ? state.byBook[book.id] : undefined,
    );
    const online = useOnlineStatus();

    const visual = useMemo<SyncVisual>(() => {
        if (!book || !remote) {
            return {
                kind: "local",
                label: "本地账本",
                title: "这个账本还没有连接远程仓库",
                icon: CloudOff,
                className: "border-line bg-surface-2/60 text-muted",
                dotClassName: "bg-muted/60",
            };
        }
        if (!remote.autoSync) {
            return {
                kind: "disabled",
                label: "自动同步关闭",
                title: "当前账本已关闭自动同步，可在数据源页手动同步",
                icon: CloudOff,
                className: "border-line bg-surface-2/60 text-muted",
                dotClassName: "bg-muted/60",
            };
        }
        if (!online) {
            return {
                kind: "offline",
                label: "离线",
                title: "当前离线，数据保存在本机，联网后会自动同步",
                icon: CloudOff,
                className: "border-liability/25 bg-liability-soft text-liability",
                dotClassName: "bg-liability",
            };
        }
        if (live?.phase === "syncing") {
            return {
                kind: "syncing",
                label: "同步中",
                title: "正在和远程仓库同步",
                icon: Cloud,
                className: "border-accent/25 bg-accent-soft text-accent",
                dotClassName: "animate-pulse bg-accent",
            };
        }
        if (live?.phase === "error") {
            return {
                kind: "error",
                label: "同步失败",
                title: live.message
                    ? `${live.message} · ${lastSyncText(remote.lastSyncedAt)}`
                    : lastSyncText(remote.lastSyncedAt),
                icon: CloudAlert,
                className: "border-danger/25 bg-danger-soft text-danger",
                dotClassName: "bg-danger",
            };
        }

        const pending =
            !remote.lastSyncedAt || (book.updatedAt ?? 0) > remote.lastSyncedAt;
        if (pending) {
            return {
                kind: "pending",
                label: "待同步",
                title: `${lastSyncText(remote.lastSyncedAt)} · 本地有新修改`,
                icon: CloudUpload,
                className: "border-accent/25 bg-accent-soft text-accent",
                dotClassName: "animate-pulse bg-accent",
            };
        }

        return {
            kind: "synced",
            label: "已同步",
            title: lastSyncText(remote.lastSyncedAt),
            icon: CloudCheck,
            className: "border-success/25 bg-success-soft text-success",
            dotClassName: "bg-success",
        };
    }, [book, live, online, remote]);

    const Icon = visual.icon;

    return (
        <Link
            to="/data"
            aria-label={`远程同步状态：${visual.label}`}
            title={visual.title}
            className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition hover:brightness-[0.98]",
                visual.className,
            )}
        >
            <Icon
                className={cn(
                    "size-4 shrink-0",
                    visual.kind === "syncing" && "animate-pulse",
                )}
            />
            <span className="hidden sm:inline">{visual.label}</span>
            <span
                className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    visual.dotClassName,
                )}
            />
        </Link>
    );
}
