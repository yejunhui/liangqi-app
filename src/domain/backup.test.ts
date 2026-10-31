/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Bill, Entry, LedgerData } from "@/types";
import { createSeedData } from "@/domain/seed";
import { createSeedBook } from "@/domain/seed";
import {
    createExportPayload,
    createLibraryExport,
    parseBackup,
    parseLibraryBackup,
} from "@/domain/backup";
import type { LibraryData } from "@/types";

const NOW = new Date(2026, 9, 31, 12).getTime();

function buildData(): LedgerData {
    const data = createSeedData(NOW);
    const bill: Bill = {
        id: "bill_test",
        liabilityAccountId: "acc_credit",
        categoryId: "cat_food",
        title: "聚餐",
        principal: 20_000,
        purchasedAt: NOW,
        dueDate: new Date(2026, 10, 10, 12).getTime(),
        createdAt: NOW,
    };
    const creditExpense: Entry = {
        id: "entry_credit",
        kind: "expense",
        amount: 20_000,
        date: NOW,
        liabilityAccountId: "acc_credit",
        billId: bill.id,
        categoryId: "cat_food",
        createdAt: NOW,
    };
    const repayment: Entry = {
        id: "entry_repay",
        kind: "repayment",
        amount: 5_000,
        date: NOW,
        accountId: "acc_bank",
        liabilityAccountId: "acc_credit",
        billId: bill.id,
        createdAt: NOW,
    };
    const cashExpense: Entry = {
        id: "entry_cash",
        kind: "expense",
        amount: 1_000,
        date: NOW,
        accountId: "acc_cash",
        categoryId: "cat_food",
        createdAt: NOW,
    };
    data.bills.push(bill);
    data.entries.push(creditExpense, repayment, cashExpense);
    return data;
}

describe("backup round trip", () => {
    it("accepts its own export after JSON serialization", () => {
        const data = buildData();
        const payload = createExportPayload(data);
        const parsed = parseBackup(JSON.parse(JSON.stringify(payload)));
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.data.accounts).toHaveLength(data.accounts.length);
            expect(parsed.data.bills).toHaveLength(1);
            expect(parsed.data.entries).toHaveLength(3);
            expect(parsed.data.settings.currency).toBe("CNY");
        }
    });

    it("accepts an opening-balance bill without a linked expense", () => {
        const data = createSeedData(NOW);
        const liability = {
            ...data.accounts[2],
            id: "acc_huabei",
            name: "花呗",
            openingBalance: 50_000,
        };
        data.accounts.push(liability);
        data.bills.push({
            id: "bill_opening",
            liabilityAccountId: liability.id,
            title: "期初负债",
            principal: 50_000,
            purchasedAt: NOW,
            opening: true,
            createdAt: NOW,
        });

        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(true);
    });

    it("rejects a liability opening balance without a matching opening bill", () => {
        const data = createSeedData(NOW);
        data.accounts.push({
            ...data.accounts[2],
            id: "acc_huabei",
            name: "花呗",
            openingBalance: 50_000,
        });

        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain("期初账单");
        }
    });
});

describe("backup validation", () => {
    it("accepts a legacy Zhaibu export", () => {
        const payload = createExportPayload(buildData());
        const parsed = parseBackup({ ...payload, app: "zhaibu" });
        expect(parsed.ok).toBe(true);
    });
    it("rejects a different app or version", () => {
        const payload = createExportPayload(buildData());
        expect(parseBackup({ ...payload, app: "cent" }).ok).toBe(false);
        expect(parseBackup({ ...payload, version: 2 }).ok).toBe(false);
    });

    it("rejects duplicate ids", () => {
        const payload = createExportPayload(buildData());
        payload.accounts.push({ ...payload.accounts[0] });
        const parsed = parseBackup(payload);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain("重复");
        }
    });

    it("rejects a repayment larger than the bill principal", () => {
        const data = buildData();
        data.entries.push({
            ...data.entries[1],
            id: "entry_overpay",
            amount: 20_000,
        });
        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain("超过本金");
        }
    });

    it("rejects a bill without its credit expense", () => {
        const data = buildData();
        data.entries = data.entries.filter((entry) => entry.id !== "entry_credit");
        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain("缺少对应");
        }
    });

    it("rejects a cash expense that also points at a liability", () => {
        const data = buildData();
        const cash = data.entries.find((entry) => entry.id === "entry_cash");
        if (cash) {
            cash.liabilityAccountId = "acc_credit";
        }
        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain("负债");
        }
    });

    it("rejects invalid settings", () => {
        const data = buildData();
        data.settings.currency = "rmb";
        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(false);
    });

    it("round-trips member ids and rejects unknown members", () => {
        const data = buildData();
        data.members.push({
            id: "member_family",
            name: "家人",
            color: "#e07a5f",
            createdAt: NOW,
        });
        data.bills[0].memberId = "member_family";
        data.entries[0].memberId = "member_family";

        const parsed = parseBackup(createExportPayload(data));
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.data.members).toHaveLength(2);
            expect(parsed.data.bills[0].memberId).toBe("member_family");
            expect(parsed.data.entries[0].memberId).toBe("member_family");
        }

        const broken = buildData();
        broken.bills[0].memberId = "missing_member";
        const rejected = parseBackup(createExportPayload(broken));
        expect(rejected.ok).toBe(false);
        if (!rejected.ok) {
            expect(rejected.error).toContain("成员");
        }
    });
});

describe("library backup", () => {
    function buildLibrary(): LibraryData {
        const first = createSeedBook("家庭账", NOW);
        const second = createSeedBook("旅行账", NOW + 1);
        return {
            version: 2,
            books: [
                first,
                {
                    ...second,
                    remote: {
                        connectionId: "conn_1",
                        remoteBookId: second.id,
                        autoSync: true,
                        lastSyncedAt: NOW,
                    },
                },
            ],
            activeBookId: first.id,
            connections: [
                {
                    id: "conn_1",
                    provider: "github",
                    label: "GitHub · me/ledger",
                    createdAt: NOW,
                    owner: "me",
                    repo: "ledger",
                    branch: "main",
                    token: "secret-token",
                    tokenKind: "pat",
                },
            ],
        };
    }

    it("round-trips multiple books and strips secrets", () => {
        const library = buildLibrary();
        const payload = createLibraryExport(library);
        expect(payload.version).toBe(2);
        expect(payload.secretsIncluded).toBe(false);
        expect(payload.library.connections[0].token).toBeUndefined();

        const parsed = parseLibraryBackup(JSON.parse(JSON.stringify(payload)));
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.library.books).toHaveLength(2);
            expect(parsed.library.activeBookId).toBe(library.activeBookId);
            expect(parsed.library.books[1].remote?.connectionId).toBe("conn_1");
            expect(parsed.library.connections[0].token).toBeUndefined();
        }
    });

    it("rejects duplicate book ids", () => {
        const library = buildLibrary();
        library.books[1] = { ...library.books[1], id: library.books[0].id };
        const parsed = parseLibraryBackup(createLibraryExport(library));
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain("重复账本");
        }
    });

    it("rejects the wrong version", () => {
        const payload = createLibraryExport(buildLibrary());
        expect(parseLibraryBackup({ ...payload, version: 1 }).ok).toBe(false);
    });
});
