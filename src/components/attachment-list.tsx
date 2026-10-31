/**
 * SPDX-License-Identifier: GPL-3.0-or-later
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
import { toast } from "@/store/toast";

interface AttachmentListProps {
    target: { kind: "entry" | "bill"; id: string };
    attachmentIds: string[] | undefined;
    label?: string;
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
    label = "附件",
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
            toast(`单个附件不能超过 10 MB：${tooLarge.name}`, "error");
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
            toast(`已添加 ${metas.length} 个附件`, "success");
        } catch {
            await Promise.all(metas.map((meta) => deleteAttachmentFile(meta.id)));
            toast("附件保存失败，浏览器可能不允许本地存储", "error");
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
        await deleteAttachmentFile(deleting.id);
        toast("附件已删除", "success");
        setDeleting(null);
    }

    async function handleOpen(attachment: Attachment) {
        const opened = await openAttachmentFile(attachment);
        if (!opened) {
            toast("附件文件不在本机：它可能来自其他设备的同步", "info");
        }
    }

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                    <Paperclip className="size-3" />
                    {label}
                </p>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-muted transition hover:text-text disabled:opacity-50"
                >
                    <Plus className="size-3" />
                    {uploading ? "保存中…" : "添加"}
                </button>
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
                <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-2.5 text-[10px] text-muted">
                    可以添加小票、发票或截图，文件只保存在本机。
                </p>
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
                                    {formatFileSize(attachment.size)}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeleting(attachment)}
                                className="grid size-6 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
                                aria-label="删除附件"
                            >
                                <Trash2 className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                title="删除这个附件？"
                description={deleting ? `“${deleting.name}”会从本机删除，无法恢复。` : ""}
                confirmLabel="删除"
                onConfirm={handleDelete}
            />
        </div>
    );
}
