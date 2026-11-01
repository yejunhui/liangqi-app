/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export function newId(prefix: string): string {
    const uuid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${uuid}`;
}
