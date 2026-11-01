/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createStore, get, set } from "idb-keyval";

const chunkStore = createStore("liangqi-remote-chunks", "chunks");

export async function readCachedChunk(hash: string): Promise<string | undefined> {
    try {
        const value = await get<string>(hash, chunkStore);
        return typeof value === "string" ? value : undefined;
    } catch {
        return undefined;
    }
}

export async function cacheChunk(hash: string, text: string): Promise<void> {
    try {
        await set(hash, text, chunkStore);
    } catch {
        // Cache is an optimization; a failed write should not break sync.
    }
}
