/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { LedgerData, Member } from "@/types";

export const DEFAULT_MEMBER_ID = "member_me";

export const MEMBER_COLORS = [
    "#0f766e",
    "#e07a5f",
    "#3d8bfd",
    "#c084fc",
    "#f2b84b",
    "#fb7185",
    "#14b8a6",
    "#60a5fa",
    "#a8a29e",
] as const;

export function createDefaultMember(now = Date.now()): Member {
    return {
        id: DEFAULT_MEMBER_ID,
        name: "我",
        color: MEMBER_COLORS[0],
        createdAt: now,
    };
}

export function ensureMembers<T extends LedgerData>(data: T, now = Date.now()): T {
    if (Array.isArray(data.members) && data.members.length > 0) {
        return data;
    }
    return { ...data, members: [createDefaultMember(now)] } as T;
}

export function findMember(members: Member[], memberId?: string): Member | undefined {
    if (!memberId) {
        return undefined;
    }
    return members.find((member) => member.id === memberId);
}
