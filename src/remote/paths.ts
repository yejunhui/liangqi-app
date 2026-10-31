/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * One repository stores exactly one ledger. New layout lives at the repo root
 * under `liangqi/`; the old multi-book layout is kept for migration reads.
 */

export const REMOTE_ROOT = "liangqi";
export const REMOTE_META_PATH = `${REMOTE_ROOT}/meta.json`;
export const REMOTE_MANIFEST_PATH = `${REMOTE_ROOT}/manifest.json`;

/** Legacy multi-book layout. */
export const REMOTE_INDEX_PATH = `${REMOTE_ROOT}/index.json`;
export const REMOTE_BOOKS_DIR = `${REMOTE_ROOT}/books`;
export const REMOTE_BACKUPS_DIR = `${REMOTE_ROOT}/backups`;

export function remoteBookPath(bookId: string): string {
    return `${REMOTE_BOOKS_DIR}/${bookId}.json`;
}

export function legacyRemoteBookDir(bookId: string): string {
    return `${REMOTE_BOOKS_DIR}/${bookId}`;
}

export function legacyRemoteBookMetaPath(bookId: string): string {
    return `${legacyRemoteBookDir(bookId)}/meta.json`;
}

export function legacyRemoteBookManifestPath(bookId: string): string {
    return `${legacyRemoteBookDir(bookId)}/manifest.json`;
}

export function legacyRemoteChunkPath(
    bookId: string,
    kind: "entries" | "bills",
    start: number,
): string {
    return `${legacyRemoteBookDir(bookId)}/${kind}-${start}.json`;
}

export function remoteBookMetaPath(_bookId?: string): string {
    return REMOTE_META_PATH;
}

export function remoteBookManifestPath(_bookId?: string): string {
    return REMOTE_MANIFEST_PATH;
}

export function remoteChunkPath(
    _bookId: string | undefined,
    kind: "entries" | "bills",
    start: number,
): string {
    return `${REMOTE_ROOT}/${kind}-${start}.json`;
}

export function remoteBackupPath(bookId: string, timestamp: number): string {
    return `${REMOTE_BACKUPS_DIR}/${bookId}-${timestamp}.json`;
}
