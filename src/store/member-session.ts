/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Local "who am I" selection per book. The repo is shared with one private
 * key; each device/user picks the member they are, and that member becomes the
 * author of new entries.
 */

import { create } from "zustand";
import type { Book, Member } from "@/types";
import { useLibraryStore } from "@/store/library";

const SESSION_KEY = "liangqi-active-members-v1";

function readSessions(): Record<string, string> {
    if (typeof window === "undefined") {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (!raw) {
            return {};
        }
        const value: unknown = JSON.parse(raw);
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return {};
        }
        return value as Record<string, string>;
    } catch {
        return {};
    }
}

function writeSessions(value: Record<string, string>): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } catch {
        // The selection still works for this session.
    }
}

interface MemberSessionState {
    byBook: Record<string, string>;
    setActiveMember: (bookId: string, memberId: string) => void;
    clearActiveMember: (bookId: string) => void;
}

export const useMemberSessionStore = create<MemberSessionState>()((set) => ({
    byBook: readSessions(),
    setActiveMember(bookId, memberId) {
        const next = { ...useMemberSessionStore.getState().byBook, [bookId]: memberId };
        writeSessions(next);
        set({ byBook: next });
    },
    clearActiveMember(bookId) {
        const next = { ...useMemberSessionStore.getState().byBook };
        delete next[bookId];
        writeSessions(next);
        set({ byBook: next });
    },
}));

export function getMemberForBook(book: Book | undefined): Member | undefined {
    if (!book || book.members.length === 0) {
        return undefined;
    }
    const selectedId = useMemberSessionStore.getState().byBook[book.id];
    if (selectedId) {
        return book.members.find((member) => member.id === selectedId);
    }
    // Local-only books can fall back to the first member. A shared remote book
    // must explicitly choose an identity so multiple users don't become "我".
    return book.remote ? undefined : book.members[0];
}

export function getActiveMember(): Member | undefined {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    return getMemberForBook(book);
}

export function useActiveMember(): Member | undefined {
    const book = useLibraryStore((state) =>
        state.books.find((item) => item.id === state.activeBookId),
    );
    const selectedId = useMemberSessionStore((state) =>
        book ? state.byBook[book.id] : undefined,
    );
    if (!book || book.members.length === 0) {
        return undefined;
    }
    if (!selectedId) {
        return book.remote ? undefined : book.members[0];
    }
    return book.members.find((member) => member.id === selectedId);
}

export function canModifyOwner(ownerId?: string): boolean {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    if (!book?.remote) {
        return true;
    }
    const member = getActiveMember();
    if (!member) {
        return false;
    }
    return !ownerId || ownerId === member.id;
}

export function useCanModifyOwner(ownerId?: string): boolean {
    const book = useLibraryStore((state) =>
        state.books.find((item) => item.id === state.activeBookId),
    );
    const member = useActiveMember();
    if (!book?.remote) {
        return true;
    }
    if (!member) {
        return false;
    }
    return !ownerId || ownerId === member.id;
}
