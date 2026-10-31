/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const REMOTE_ROOT = "liangqi";
export const REMOTE_INDEX_PATH = `${REMOTE_ROOT}/index.json`;
export const REMOTE_BOOKS_DIR = `${REMOTE_ROOT}/books`;
export const REMOTE_BACKUPS_DIR = `${REMOTE_ROOT}/backups`;

export function remoteBookPath(bookId: string): string {
    return `${REMOTE_BOOKS_DIR}/${bookId}.json`;
}

export function remoteBookDir(bookId: string): string {
    return `${REMOTE_BOOKS_DIR}/${bookId}`;
}

export function remoteBookMetaPath(bookId: string): string {
    return `${remoteBookDir(bookId)}/meta.json`;
}

export function remoteBookManifestPath(bookId: string): string {
    return `${remoteBookDir(bookId)}/manifest.json`;
}

export function remoteChunkPath(
    bookId: string,
    kind: "entries" | "bills",
    start: number,
): string {
    return `${remoteBookDir(bookId)}/${kind}-${start}.json`;
}

export function remoteBackupPath(bookId: string, timestamp: number): string {
    return `${REMOTE_BACKUPS_DIR}/${bookId}-${timestamp}.json`;
}
