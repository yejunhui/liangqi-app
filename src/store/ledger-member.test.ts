/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Book } from "@/types";
import { createSeedBook } from "@/domain/seed";
import { useLibraryStore } from "@/store/library";
import { useLedgerStore } from "@/store/ledger";
import { useMemberSessionStore } from "@/store/member-session";

const NOW = new Date(2026, 9, 31, 12, 0, 0, 0).getTime();

function createTwoMemberBook(): Book {
    const book = createSeedBook("共享账", NOW);
    book.members = [
        {
            id: "member_alice",
            name: "Alice",
            color: "#0f766e",
            pinHash: "test-hash-alice",
            pinSalt: "test-salt-alice",
            pinIterations: 1,
            createdAt: NOW,
        },
        {
            id: "member_bob",
            name: "Bob",
            color: "#c2410c",
            pinHash: "test-hash-bob",
            pinSalt: "test-salt-bob",
            pinIterations: 1,
            createdAt: NOW + 1,
        },
    ];
    return book;
}

describe("ledger member defaults", () => {
    let book: Book;

    beforeEach(() => {
        book = createTwoMemberBook();
        useLibraryStore.setState({
            version: 2,
            books: [book],
            activeBookId: book.id,
            connections: [],
        });
        useLedgerStore.setState(book);
        useMemberSessionStore.setState({
            byBook: { [book.id]: "member_bob" },
            unlocked: { [`${book.id}:member_bob`]: true },
        });
    });

    it("attributes a new expense to the logged-in member by default", () => {
        const result = useLedgerStore.getState().addExpense({
            amount: 1_200,
            date: NOW,
            categoryId: "cat_food",
            source: { type: "asset", accountId: "acc_cash" },
        });

        expect(result.ok).toBe(true);
        const entry = useLedgerStore.getState().entries.at(-1);
        expect(entry?.memberId).toBe("member_bob");
        expect(entry?.ownerId).toBe("member_bob");
    });

    it("attributes a new income to the logged-in member by default", () => {
        const result = useLedgerStore.getState().addIncome({
            amount: 5_000,
            date: NOW,
            categoryId: "cat_salary",
            accountId: "acc_bank",
        });

        expect(result.ok).toBe(true);
        const entry = useLedgerStore.getState().entries.at(-1);
        expect(entry?.memberId).toBe("member_bob");
        expect(entry?.ownerId).toBe("member_bob");
    });

    it("keeps a credit purchase and its bill under the same member", () => {
        const result = useLedgerStore.getState().addExpense({
            amount: 3_000,
            date: NOW,
            categoryId: "cat_food",
            source: { type: "liability", accountId: "acc_credit" },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        const state = useLedgerStore.getState();
        const entry = state.entries.find((item) => item.id === result.entryId);
        const bill = state.bills.find((item) => item.id === result.billId);
        expect(entry?.memberId).toBe("member_bob");
        expect(bill?.memberId).toBe("member_bob");

        const repay = state.addRepayment({
            amount: 1_000,
            date: NOW,
            billId: result.billId!,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
        });
        expect(repay.ok).toBe(true);
        if (!repay.ok) {
            return;
        }
        const repayment = useLedgerStore
            .getState()
            .entries.find((item) => item.id === repay.entryId);
        expect(repayment?.categoryId).toBe("cat_food");
    });

    it("rejects a direct repayment when the liability has no outstanding balance", () => {
        const result = useLedgerStore.getState().addRepayment({
            amount: 1_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain("没有待还余额");
        }
    });

    it("records a direct repayment from an asset account to a liability account", () => {
        const state = useLedgerStore.getState();
        const purchase = state.addExpense({
            amount: 10_000,
            date: NOW,
            categoryId: "cat_food",
            source: { type: "liability", accountId: "acc_credit" },
        });
        expect(purchase.ok).toBe(true);
        if (!purchase.ok) {
            return;
        }

        const repay = state.addRepayment({
            amount: 4_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
        });
        expect(repay.ok).toBe(true);
        if (!repay.ok) {
            return;
        }

        const repayment = useLedgerStore
            .getState()
            .entries.find((item) => item.id === repay.entryId);
        expect(repayment?.kind).toBe("repayment");
        expect(repayment?.billId).toBeUndefined();
        expect(repayment?.liabilityAccountId).toBe("acc_credit");
        expect(repayment?.memberId).toBe("member_bob");
    });

    it("records member update timestamps for shared-ledger merge", () => {
        const result = useLedgerStore
            .getState()
            .updateMember("member_alice", { name: "Alice Updated" });
        expect(result.ok).toBe(true);
        const member = useLedgerStore
            .getState()
            .members.find((item) => item.id === "member_alice");
        expect(member?.updatedAt).toBeGreaterThanOrEqual(NOW);
        expect(member?.fieldUpdatedAt?.name).toBe(member?.updatedAt);
    });

    it("does not touch the book when no recurring rule is due", () => {
        useLedgerStore.setState({
            recurringRules: [
                {
                    id: "recurring_future",
                    name: "未来的房租",
                    kind: "expense",
                    amount: 100_000,
                    frequency: "monthly",
                    interval: 1,
                    startDate: NOW + 86_400_000,
                    nextDueDate: NOW + 86_400_000,
                    enabled: true,
                    categoryId: "cat_home",
                    accountId: "acc_cash",
                    memberId: "member_bob",
                    ownerId: "member_bob",
                    ownerName: "Bob",
                    createdAt: NOW,
                },
            ],
        });
        const before = useLedgerStore.getState().updatedAt;

        const result = useLedgerStore.getState().postDueRecurring(NOW);

        expect(result).toEqual({ ok: true, posted: 0 });
        expect(useLedgerStore.getState().updatedAt).toBe(before);
    });
});
