/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useRef, useState, type ChangeEvent } from "react";
import { FileText, Image as ImageIcon, Paperclip, Plus, Trash2 } from "lucide-react";
import type { Attachment } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
    MAX_ATTACHMENT_SIZE,
    createAttachmentMeta,
    deleteAttachmentFile,
    isImageAttachment,
    openAttachmentFile,
    saveAttachmentFile,
} from "@/domain/attachments";
import { useLedgerStore } from "@/store/ledger";
import { getConnectionById, useLibraryStore } from "@/store/library";
import { downloadRemoteAttachment, deleteRemoteAttachment } from "@/remote/attachments";
import { toast } from "@/store/toast";

import { t } from "@/i18n";

interface AttachmentListProps {
    target: { kind: "entry" | "bill"; id: string };
    attachmentIds: string[] | undefined;
    label?: string;
    readOnly?: boolean;
}

function formatFileSize(size: number): string {
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
    target,
    attachmentIds,
    label = t("附件"),
    readOnly = false,
}: AttachmentListProps) {
    const attachments = useLedgerStore((state) => state.attachments);
    const addAttachments = useLedgerStore((state) => state.addAttachments);
    const deleteAttachment = useLedgerStore((state) => state.deleteAttachment);
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<Attachment | null>(null);

    const items = (attachmentIds ?? [])
        .map((id) => attachments.find((item) => item.id === id))
        .filter((item): item is Attachment => item !== undefined);

    async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (files.length === 0) {
            return;
        }
        const tooLarge = files.find((file) => file.size > MAX_ATTACHMENT_SIZE);
        if (tooLarge) {
            toast(t("单个附件不能超过 10 MB：{0}", [tooLarge.name]), "error");
            return;
        }
        setUploading(true);
        const metas = files.map(createAttachmentMeta);
        try {
            for (let index = 0; index < files.length; index += 1) {
                await saveAttachmentFile(metas[index].id, files[index]);
            }
            const result = addAttachments(target, metas);
            if (!result.ok) {
                await Promise.all(metas.map((meta) => deleteAttachmentFile(meta.id)));
                toast(result.error, "error");
                return;
            }
            toast(t("已添加 {0} 个附件", [metas.length]), "success");
        } catch {
            await Promise.all(metas.map((meta) => deleteAttachmentFile(meta.id)));
            toast(t("附件保存失败，浏览器可能不允许本地存储"), "error");
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete() {
        if (!deleting) {
            return;
        }
        const result = deleteAttachment(deleting.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        const library = useLibraryStore.getState();
        const book = library.books.find((item) => item.id === library.activeBookId);
        const connection = book?.remote
            ? getConnectionById(library, book.remote.connectionId)
            : undefined;
        if (connection) {
            await deleteRemoteAttachment(connection, deleting.id);
        }
        await deleteAttachmentFile(deleting.id);
        toast(t("附件已删除"), "success");
        setDeleting(null);
    }

    async function handleOpen(attachment: Attachment) {
        const library = useLibraryStore.getState();
        const book = library.books.find((item) => item.id === library.activeBookId);
        const connection = book?.remote
            ? getConnectionById(library, book.remote.connectionId)
            : undefined;
        const opened = await openAttachmentFile(
            attachment,
            connection
                ? () => downloadRemoteAttachment(connection, attachment)
                : undefined,
        );
        if (!opened) {
            toast(t("附件文件不在本机，远程也没有找到"), "info");
        }
    }

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                    <Paperclip className="size-3" />
                    {label}
                </p>
                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-muted transition hover:text-text disabled:opacity-50"
                    >
                        <Plus className="size-3" />
                        {uploading ? t("保存中…") : t("添加")}
                    </button>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/plain"
                className="hidden"
                onChange={handleFiles}
            />

            {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-2.5 text-[10px] text-muted">{t("可以添加小票、发票或截图，文件只保存在本机。")}</p>
            ) : (
                <div className="space-y-1.5">
                    {items.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/40 px-2.5 py-2"
                        >
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-muted">
                                {isImageAttachment(attachment) ? (
                                    <ImageIcon className="size-3.5" />
                                ) : (
                                    <FileText className="size-3.5" />
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => void handleOpen(attachment)}
                                className="min-w-0 flex-1 text-left"
                            >
                                <span className="block truncate text-[11px] font-medium text-text">
                                    {attachment.name}
                                </span>
                                <span className="block text-[9px] text-muted">
                                    {formatFileSize(attachment.size)} ·{" "}
                                    {attachment.remoteUploadedAt ? t("已同步") : t("仅本机")}
                                </span>
                            </button>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => setDeleting(attachment)}
                                    className="grid size-6 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
                                    aria-label={t("删除附件")}
                                >
                                    <Trash2 className="size-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                title={t("删除这个附件？")}
                description={deleting ? t("“{0}”会从本机删除，无法恢复。", [deleting.name]) : ""}
                confirmLabel={t("删除")}
                onConfirm={handleDelete}
            />
        </div>
    );
}
