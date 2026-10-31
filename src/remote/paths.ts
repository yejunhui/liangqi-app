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

export function remoteBackupPath(bookId: string, timestamp: number): string {
    return `${REMOTE_BACKUPS_DIR}/${bookId}-${timestamp}.json`;
}
