/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createStore, del, get, set } from "idb-keyval";
import type { Attachment } from "@/types";
import { newId } from "@/utils/id";

const attachmentStore = createStore("liangqi-attachments", "files");

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export function createAttachmentMeta(file: File): Attachment {
    return {
        id: newId("attachment"),
        name: file.name || "附件",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        createdAt: Date.now(),
    };
}

export async function saveAttachmentFile(id: string, file: File | Blob): Promise<void> {
    await set(id, file, attachmentStore);
}

export async function loadAttachmentFile(id: string): Promise<Blob | undefined> {
    const value = await get<Blob>(id, attachmentStore);
    return value instanceof Blob ? value : undefined;
}

export async function deleteAttachmentFile(id: string): Promise<void> {
    try {
        await del(id, attachmentStore);
    } catch {
        // The metadata is still removed even if the local blob is already gone.
    }
}

export function isImageAttachment(attachment: Attachment): boolean {
    return attachment.mimeType.startsWith("image/");
}

export async function openAttachmentFile(attachment: Attachment): Promise<boolean> {
    const blob = await loadAttachmentFile(attachment.id);
    if (!blob) {
        return false;
    }
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank");
    if (opened) {
        opened.opener = null;
    } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = attachment.name;
        link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
}
