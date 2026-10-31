/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Attachment binaries are stored as base64 JSON files next to the ledger so
 * every device sharing the repository can fetch them on demand.
 */

import type { Attachment, Connection } from "@/types";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";
import { createRemoteAdapter } from "@/remote/index";
import { remoteAttachmentPath } from "@/remote/paths";
import { loadAttachmentFile, saveAttachmentFile } from "@/domain/attachments";

export const MAX_REMOTE_ATTACHMENT_SIZE = 5 * 1024 * 1024;

interface RemoteAttachmentFile {
    app: "liangqi";
    version: 1;
    attachment: {
        id: string;
        name: string;
        mimeType: string;
        size: number;
        createdAt: number;
        ownerId?: string;
        ownerName?: string;
    };
    data: string;
}

export async function uploadPendingAttachments(
    connection: Connection,
    attachments: Attachment[],
): Promise<Attachment[]> {
    const pending = attachments.filter(
        (attachment) =>
            !attachment.remoteUploadedAt &&
            attachment.size <= MAX_REMOTE_ATTACHMENT_SIZE,
    );
    if (pending.length === 0) {
        return attachments;
    }
    const adapter = createRemoteAdapter(connection);
    const uploaded = new Map<string, number>();
    for (const attachment of pending) {
        try {
            const blob = await loadAttachmentFile(attachment.id);
            if (!blob) {
                continue;
            }
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const payload: RemoteAttachmentFile = {
                app: "liangqi",
                version: 1,
                attachment: {
                    id: attachment.id,
                    name: attachment.name,
                    mimeType: attachment.mimeType,
                    size: attachment.size,
                    createdAt: attachment.createdAt,
                    ownerId: attachment.ownerId,
                    ownerName: attachment.ownerName,
                },
                data: bytesToBase64(bytes),
            };
            await adapter.writeFile(
                remoteAttachmentPath(attachment.id),
                JSON.stringify(payload),
            );
            uploaded.set(attachment.id, Date.now());
        } catch {
            // Leave the attachment pending; the next sync retries it.
        }
    }
    if (uploaded.size === 0) {
        return attachments;
    }
    return attachments.map((attachment) =>
        uploaded.has(attachment.id)
            ? {
                  ...attachment,
                  remoteUploadedAt: uploaded.get(attachment.id),
              }
            : attachment,
    );
}

export async function downloadRemoteAttachment(
    connection: Connection,
    attachment: Attachment,
): Promise<Blob | undefined> {
    const adapter = createRemoteAdapter(connection);
    const file = await adapter.readFile(remoteAttachmentPath(attachment.id));
    if (!file) {
        return undefined;
    }
    try {
        const payload = JSON.parse(file.text) as Partial<RemoteAttachmentFile>;
        if (payload.app !== "liangqi" || typeof payload.data !== "string") {
            return undefined;
        }
        const bytes = base64ToBytes(payload.data);
        const blob = new Blob([bytes as unknown as BlobPart], {
            type: attachment.mimeType,
        });
        await saveAttachmentFile(attachment.id, blob);
        return blob;
    } catch {
        return undefined;
    }
}
