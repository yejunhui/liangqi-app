/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Check,
    Cloud,
    Database,
    Pencil,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLibraryStore, getActiveBook } from "@/store/library";
import {
    activateBook,
    createAndActivateBook,
    deleteBook,
    renameBook,
} from "@/store/book-actions";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";
import { formatRelativeDay } from "@/utils/date";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

export function BookSwitcher() {
    const open = useUIStore((state) => state.bookSwitcherOpen);
    const close = useUIStore((state) => state.closeBookSwitcher);
    const library = useLibraryStore();
    const activeBook = getActiveBook(library);
    const navigate = useNavigate();

    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const deletingBook = library.books.find((book) => book.id === deletingId);

    function handleSwitch(bookId: string) {
        if (activateBook(bookId)) {
            close();
        }
    }

    function handleCreate() {
        const name = newName.trim();
        if (!name) {
            toast(t("请输入账本名称"), "error");
            return;
        }
        createAndActivateBook(name);
        setNewName("");
        close();
        toast(t("账本已创建"), "success");
    }

    function startRename(bookId: string, name: string) {
        setEditingId(bookId);
        setDraftName(name);
    }

    function saveRename() {
        if (!editingId) {
            return;
        }
        if (!renameBook(editingId, draftName)) {
            toast(t("账本名称不能为空"), "error");
            return;
        }
        setEditingId(null);
        toast(t("账本已重命名"), "success");
    }

    function handleDelete() {
        if (!deletingId) {
            return;
        }
        if (!deleteBook(deletingId)) {
            toast(t("至少保留一个账本"), "error");
            return;
        }
        setDeletingId(null);
        toast(t("账本已删除"), "success");
    }

    return (
        <>
            <Modal
                open={open}
                onClose={close}
                title={t("切换账本")}
                description={t("本地书库可以放多个账本；连接远程后，一个仓库也可以放多个账本。")}
                size="sm"
                footer={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => {
                                close();
                                navigate("/data");
                            }}
                        >
                            <Database className="size-3.5" />{` ${t("数据源")}`}</Button>
                        <Button variant="secondary" className="flex-1" onClick={close}>{t("关闭")}</Button>
                    </div>
                }
            >
                <div className="space-y-2">
                    {library.books.map((book) => {
                        const active = book.id === activeBook.id;
                        const editing = editingId === book.id;
                        return (
                            <div
                                key={book.id}
                                className={cn(
                                    "rounded-xl border p-3 transition",
                                    active
                                        ? "border-accent bg-accent-soft/45"
                                        : "border-line bg-surface-2/35 hover:border-line-strong",
                                )}
                            >
                                {editing ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            className="field py-1.5 text-xs"
                                            value={draftName}
                                            onChange={(event) => setDraftName(event.target.value)}
                                            autoFocus
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    saveRename();
                                                }
                                                if (event.key === "Escape") {
                                                    setEditingId(null);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={saveRename}
                                            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-surface"
                                            aria-label={t("保存名称")}
                                        >
                                            <Check className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted"
                                            aria-label={t("取消重命名")}
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSwitch(book.id)}
                                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                        >
                                            <span
                                                className={cn(
                                                    "grid size-8 shrink-0 place-items-center rounded-lg",
                                                    active
                                                        ? "bg-accent text-surface"
                                                        : "bg-surface-2 text-muted",
                                                )}
                                            >
                                                {active ? (
                                                    <Check className="size-4" />
                                                ) : (
                                                    <Database className="size-4" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="truncate text-sm font-semibold text-text">
                                                        {book.name}
                                                    </span>
                                                    {book.remote && (
                                                        <span className="chip bg-accent-soft text-accent">
                                                            <Cloud className="size-2.5" />{` ${t("远程")}`}</span>
                                                    )}
                                                </span>
                                                <span className="mt-0.5 block text-[10px] text-muted">
                                                    {book.entries.length}{` ${t("笔流水 · 更新于")}`}{" "}
                                                    {formatRelativeDay(book.updatedAt)}
                                                </span>
                                            </span>
                                        </button>
                                        <div className="flex shrink-0 items-center gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() => startRename(book.id, book.name)}
                                                className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
                                                aria-label={t("重命名账本")}
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeletingId(book.id)}
                                                disabled={library.books.length <= 1}
                                                className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                                                aria-label={t("删除账本")}
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-5 rounded-xl border border-dashed border-line bg-surface-2/30 p-3">
                    <p className="text-[11px] font-semibold text-text">{t("新建账本")}</p>
                    <div className="mt-2 flex gap-2">
                        <input
                            className="field py-2 text-xs"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            placeholder={t("例如：家庭账、旅行账")}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleCreate();
                                }
                            }}
                        />
                        <Button size="sm" onClick={handleCreate}>
                            <Plus className="size-3.5" />{` ${t("创建")}`}</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={deletingBook !== undefined}
                onClose={() => setDeletingId(null)}
                title={t("删除这个账本？")}
                description={
                    deletingBook
                        ? t("“{0}”的本地数据会被删除；如果已连接远程，远程副本不会自动删除。", [deletingBook.name])
                        : ""
                }
                confirmLabel={t("删除账本")}
                onConfirm={handleDelete}
            />
        </>
    );
}
