/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Book, Member } from "@/types";
import { createSeedBook } from "@/domain/seed";
import { useLibraryStore } from "@/store/library";
import {
    getMemberForBook,
    useMemberSessionStore,
} from "@/store/member-session";

const NOW = new Date(2026, 10, 2, 12).getTime();

function member(id: string, name: string, withPin: boolean): Member {
    return {
        id,
        name,
        color: "#0f766e",
        createdAt: NOW,
        ...(withPin
            ? {
                  pinHash: `hash-${id}`,
                  pinSalt: `salt-${id}`,
                  pinIterations: 1,
              }
            : {}),
    };
}

function setBook(book: Book): void {
    useLibraryStore.setState({
        version: 2,
        books: [book],
        activeBookId: book.id,
        connections: [],
    });
}

function select(book: Book, memberId: string, unlocked = false): void {
    useMemberSessionStore.setState({
        byBook: { [book.id]: memberId },
        unlocked: unlocked ? { [`${book.id}:${memberId}`]: true } : {},
    });
}

describe("multi-member password sessions", () => {
    let book: Book;

    beforeEach(() => {
        book = createSeedBook("Test", NOW);
        book.members = [
            member("alice", "Alice", true),
            member("bob", "Bob", true),
            member("carol", "Carol", false),
        ];
        setBook(book);
    });

    it("rejects a passwordless member in a multi-member book", () => {
        select(book, "carol");
        expect(getMemberForBook(book)).toBeUndefined();
    });

    it("requires a passworded member to be unlocked", () => {
        select(book, "alice", false);
        expect(getMemberForBook(book)).toBeUndefined();
        select(book, "alice", true);
        expect(getMemberForBook(book)?.id).toBe("alice");
    });

    it("allows a single-member local book without a password", () => {
        const local = createSeedBook("Solo", NOW);
        local.members = [member("solo", "Solo", false)];
        setBook(local);
        select(local, "solo");
        expect(getMemberForBook(local)?.id).toBe("solo");
    });

    it("requires a password for a multi-member local book", () => {
        select(book, "bob", true);
        expect(getMemberForBook(book)?.id).toBe("bob");
        select(book, "carol");
        expect(getMemberForBook(book)).toBeUndefined();
    });
});
