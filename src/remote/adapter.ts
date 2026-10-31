/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RemoteProvider } from "@/types";

export interface RemoteFile {
    text: string;
    revision?: string;
}

export interface RemoteTestResult {
    defaultBranch?: string;
}

export interface RemoteAdapter {
    provider: RemoteProvider;
    test(): Promise<RemoteTestResult>;
    readFile(path: string): Promise<RemoteFile | null>;
    writeFile(
        path: string,
        text: string,
        revision?: string,
    ): Promise<{ revision?: string }>;
    /** Optional batch write. GitHub implements this with the Git Data API. */
    writeFiles?(
        files: Array<{ path: string; text: string | null }>,
        message: string,
    ): Promise<void>;
    ensureDirectory(path: string): Promise<void>;
}
