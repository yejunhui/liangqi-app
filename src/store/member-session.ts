/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Local "who am I" selection per book. The repo is shared with one private
 * key; each device/user picks the member they are. For shared books the member
 * must have a password and be unlocked in this tab session before editing.
 */

import { create } from "zustand";
import type { Book, Member } from "@/types";
import { hasMemberPin } from "@/domain/member-pin";
import { useLibraryStore } from "@/store/library";

const SESSION_KEY = "liangqi-active-members-v1";
const UNLOCKED_KEY = "liangqi-unlocked-members-v1";

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

function readUnlocked(): Record<string, boolean> {
    if (typeof window === "undefined") {
        return {};
    }
    try {
        const raw = window.sessionStorage.getItem(UNLOCKED_KEY);
        if (!raw) {
            return {};
        }
        const value: unknown = JSON.parse(raw);
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return {};
        }
        return value as Record<string, boolean>;
    } catch {
        return {};
    }
}

function writeUnlocked(value: Record<string, boolean>): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify(value));
    } catch {
        // The unlock still works for this session.
    }
}

function unlockKey(bookId: string, memberId: string): string {
    return `${bookId}:${memberId}`;
}

interface MemberSessionState {
    byBook: Record<string, string>;
    unlocked: Record<string, boolean>;
    setActiveMember: (bookId: string, memberId: string) => void;
    clearActiveMember: (bookId: string) => void;
    unlockMember: (bookId: string, memberId: string) => void;
    lockMember: (bookId: string, memberId: string) => void;
}

export const useMemberSessionStore = create<MemberSessionState>()((set) => ({
    byBook: readSessions(),
    unlocked: readUnlocked(),
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
    unlockMember(bookId, memberId) {
        const next = {
            ...useMemberSessionStore.getState().unlocked,
            [unlockKey(bookId, memberId)]: true,
        };
        writeUnlocked(next);
        set({ unlocked: next });
    },
    lockMember(bookId, memberId) {
        const next = { ...useMemberSessionStore.getState().unlocked };
        delete next[unlockKey(bookId, memberId)];
        writeUnlocked(next);
        set({ unlocked: next });
    },
}));

function bookRequiresMemberPin(book: Book): boolean {
    return Boolean(book.remote) || book.members.length > 1;
}

/** Returns the member selected for this book, even if its password is still locked. */
export function getSelectedMemberForBook(book: Book | undefined): Member | undefined {
    if (!book || book.members.length === 0) {
        return undefined;
    }
    const selectedId = useMemberSessionStore.getState().byBook[book.id];
    if (selectedId) {
        return book.members.find((member) => member.id === selectedId);
    }
    return book.remote ? undefined : book.members[0];
}

export function getMemberForBook(book: Book | undefined): Member | undefined {
    const selected = getSelectedMemberForBook(book);
    if (!book || !selected) {
        return undefined;
    }
    if (!bookRequiresMemberPin(book)) {
        return selected;
    }
    if (!hasMemberPin(selected)) {
        return undefined;
    }
    const unlocked =
        useMemberSessionStore.getState().unlocked[
            unlockKey(book.id, selected.id)
        ];
    return unlocked ? selected : undefined;
}

export function getActiveMember(): Member | undefined {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    return getMemberForBook(book);
}

export function useSelectedMember(): Member | undefined {
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

export function useActiveMember(): Member | undefined {
    const book = useLibraryStore((state) =>
        state.books.find((item) => item.id === state.activeBookId),
    );
    const selectedId = useMemberSessionStore((state) =>
        book ? state.byBook[book.id] : undefined,
    );
    const unlocked = useMemberSessionStore((state) => state.unlocked);
    if (!book || book.members.length === 0) {
        return undefined;
    }
    const selected = selectedId
        ? book.members.find((member) => member.id === selectedId)
        : book.remote
          ? undefined
          : book.members[0];
    if (!selected) {
        return undefined;
    }
    if (!bookRequiresMemberPin(book)) {
        return selected;
    }
    if (!hasMemberPin(selected)) {
        return undefined;
    }
    return unlocked[unlockKey(book.id, selected.id)] ? selected : undefined;
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
