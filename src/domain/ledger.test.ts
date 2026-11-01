/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Account, Bill, Entry } from "@/types";
import { createSeedData } from "@/domain/seed";
import {
    getAccountBalance,
    getBillDueInfo,
    getBillRemaining,
    getBillStatus,
    getCategoryBreakdown,
    getMonthTotals,
    getOpenBills,
    getOutstandingTotal,
    getTotals,
    validateRepayment,
} from "@/domain/ledger";

const NOW = new Date(2026, 9, 31, 12, 0, 0, 0).getTime();

function buildFixture() {
    const seed = createSeedData(NOW);
    const accounts: Account[] = seed.accounts.map((account) => {
        if (account.id === "acc_cash") {
            return { ...account, openingBalance: 100_000 };
        }
        if (account.id === "acc_bank") {
            return { ...account, openingBalance: 100_000 };
        }
        return account;
    });

    const bill: Bill = {
        id: "bill_1",
        liabilityAccountId: "acc_credit",
        categoryId: "cat_food",
        title: "聚餐",
        principal: 20_000,
        purchasedAt: NOW,
        dueDate: new Date(2026, 10, 10, 12).getTime(),
        createdAt: NOW,
    };

    const entries: Entry[] = [
        {
            id: "entry_cash",
            kind: "expense",
            amount: 10_000,
            date: NOW,
            accountId: "acc_cash",
            categoryId: "cat_food",
            createdAt: NOW,
        },
        {
            id: "entry_credit",
            kind: "expense",
            amount: 20_000,
            date: NOW,
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            categoryId: "cat_food",
            createdAt: NOW,
        },
        {
            id: "entry_income",
            kind: "income",
            amount: 50_000,
            date: NOW,
            accountId: "acc_bank",
            categoryId: "cat_salary",
            createdAt: NOW,
        },
    ];

    return { accounts, categories: seed.categories, bills: [bill], entries, settings: seed.settings };
}

describe("account balances", () => {
    it("deducts a cash expense from the asset account", () => {
        const data = buildFixture();
        const cash = data.accounts.find((account) => account.id === "acc_cash")!;
        expect(getAccountBalance(cash, data.entries)).toBe(90_000);
    });

    it("adds a credit expense to the liability without touching assets", () => {
        const data = buildFixture();
        const credit = data.accounts.find((account) => account.id === "acc_credit")!;
        const cash = data.accounts.find((account) => account.id === "acc_cash")!;
        expect(getAccountBalance(credit, data.entries)).toBe(20_000);
        expect(getAccountBalance(cash, data.entries)).toBe(90_000);
    });

    it("reduces both the asset and the liability on repayment", () => {
        const data = buildFixture();
        const repayment: Entry = {
            id: "entry_repay",
            kind: "repayment",
            amount: 5_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            createdAt: NOW,
        };
        data.entries.push(repayment);

        const bank = data.accounts.find((account) => account.id === "acc_bank")!;
        const credit = data.accounts.find((account) => account.id === "acc_credit")!;

        expect(getAccountBalance(bank, data.entries)).toBe(145_000);
        expect(getAccountBalance(credit, data.entries)).toBe(15_000);
    });

    it("moves money between asset accounts without changing totals", () => {
        const data = buildFixture();
        const transfer: Entry = {
            id: "entry_transfer",
            kind: "transfer",
            amount: 25_000,
            date: NOW,
            accountId: "acc_cash",
            toAccountId: "acc_bank",
            createdAt: NOW,
        };
        data.entries.push(transfer);

        const cash = data.accounts.find((account) => account.id === "acc_cash")!;
        const bank = data.accounts.find((account) => account.id === "acc_bank")!;
        expect(getAccountBalance(cash, data.entries)).toBe(65_000);
        expect(getAccountBalance(bank, data.entries)).toBe(175_000);
        expect(getTotals(data).netWorth).toBe(
            getTotals({ accounts: data.accounts, entries: data.entries.slice(0, -1) }).netWorth,
        );
        const month = getMonthTotals(data.entries, NOW);
        expect(month.expense).toBe(10_000);
        expect(month.income).toBe(50_000);
        expect(month.repayment).toBe(0);
    });
});

describe("bill lifecycle", () => {
    it("tracks open, partial and paid states", () => {
        const data = buildFixture();
        const bill = data.bills[0];

        expect(getBillStatus(bill, data.entries)).toBe("open");
        expect(getBillRemaining(bill, data.entries)).toBe(20_000);

        const partial: Entry = {
            id: "entry_partial",
            kind: "repayment",
            amount: 8_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: bill.id,
            createdAt: NOW,
        };
        data.entries.push(partial);
        expect(getBillStatus(bill, data.entries)).toBe("partial");
        expect(getBillRemaining(bill, data.entries)).toBe(12_000);

        const rest: Entry = {
            ...partial,
            id: "entry_rest",
            amount: 12_000,
        };
        data.entries.push(rest);
        expect(getBillStatus(bill, data.entries)).toBe("paid");
        expect(getBillRemaining(bill, data.entries)).toBe(0);
    });

    it("rejects a repayment larger than the remaining amount", () => {
        const data = buildFixture();
        const bill = data.bills[0];
        const bank = data.accounts.find((account) => account.id === "acc_bank");

        expect(validateRepayment(bill, data.entries, 20_001, bank)).toContain("不能超过");
        expect(validateRepayment(bill, data.entries, 20_000, bank)).toBeNull();
        expect(validateRepayment(bill, data.entries, 0, bank)).toContain("大于 0");
    });

    it("recognizes a repayment as expense while the credit purchase stays liability-only", () => {
        const data = buildFixture();
        const before = getMonthTotals(data.entries, NOW);

        data.entries.push({
            id: "entry_repay",
            kind: "repayment",
            amount: 20_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            createdAt: NOW,
        });

        const after = getMonthTotals(data.entries, NOW);
        expect(after.expense).toBe(before.expense + 20_000);
        expect(after.income).toBe(before.income);
        expect(after.repayment).toBe(20_000);
    });

    it("puts a repayment into the bill category for category analysis", () => {
        const data = buildFixture();
        data.entries.push({
            id: "entry_repay_category",
            kind: "repayment",
            amount: 5_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            categoryId: "cat_food",
            createdAt: NOW,
        });

        const breakdown = getCategoryBreakdown(data.entries, data.categories, NOW);
        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].name).toBe("餐饮");
        expect(breakdown[0].amount).toBe(15_000);
    });
});

describe("net worth", () => {
    it("computes disposable from liquid assets only", () => {
        const data = createSeedData(NOW);
        data.accounts = data.accounts.map((account) => {
            if (account.id === "acc_cash") {
                return { ...account, openingBalance: 100_000 };
            }
            if (account.id === "acc_bank") {
                return { ...account, openingBalance: 500_000 };
            }
            if (account.id === "acc_credit") {
                return { ...account, openingBalance: 50_000 };
            }
            return account;
        });
        data.accounts.push({
            id: "acc_house",
            name: "房产",
            kind: "asset",
            emoji: "🏠",
            openingBalance: 10_000_000,
            liquid: false,
            createdAt: NOW,
        });

        const totals = getTotals(data);
        expect(totals.assets).toBe(10_600_000);
        expect(totals.liabilities).toBe(50_000);
        expect(totals.netWorth).toBe(10_550_000);
        expect(totals.disposable).toBe(600_000);
    });

    it("counts an opening liability and lets it be repaid", () => {
        const data = createSeedData(NOW);
        const liability: Account = {
            id: "acc_opening",
            name: "期初借款",
            kind: "liability",
            emoji: "🧾",
            openingBalance: 50_000,
            createdAt: NOW,
        };
        const bill: Bill = {
            id: "bill_opening",
            liabilityAccountId: liability.id,
            title: "期初负债",
            principal: 50_000,
            purchasedAt: NOW,
            opening: true,
            createdAt: NOW,
        };
        data.accounts.push(liability);
        data.bills.push(bill);

        const before = getTotals(data);
        expect(before.liabilities).toBe(50_000);
        expect(before.netWorth).toBe(-50_000);
        expect(getBillRemaining(bill, data.entries)).toBe(50_000);

        data.entries.push({
            id: "entry_opening_repay",
            kind: "repayment",
            amount: 20_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: liability.id,
            billId: bill.id,
            createdAt: NOW,
        });

        const after = getTotals(data);
        expect(after.liabilities).toBe(30_000);
        expect(after.assets).toBe(-20_000);
        expect(getBillRemaining(bill, data.entries)).toBe(30_000);
    });

    it("keeps net worth unchanged after a repayment", () => {
        const data = buildFixture();
        const before = getTotals(data);

        data.entries.push({
            id: "entry_repay",
            kind: "repayment",
            amount: 5_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            createdAt: NOW,
        });

        const after = getTotals(data);
        expect(after.assets).toBe(before.assets - 5_000);
        expect(after.liabilities).toBe(before.liabilities - 5_000);
        expect(after.netWorth).toBe(before.netWorth);
    });

    it("recognises a credit expense immediately and lowers net worth", () => {
        const seed = createSeedData(NOW);
        const before = getTotals(seed);

        const bill: Bill = {
            id: "bill_new",
            liabilityAccountId: "acc_credit",
            categoryId: "cat_food",
            title: "晚餐",
            principal: 12_000,
            purchasedAt: NOW,
            createdAt: NOW,
        };
        const expense: Entry = {
            id: "entry_new",
            kind: "expense",
            amount: 12_000,
            date: NOW,
            liabilityAccountId: "acc_credit",
            billId: bill.id,
            categoryId: "cat_food",
            createdAt: NOW,
        };

        seed.bills.push(bill);
        seed.entries.push(expense);

        const after = getTotals(seed);
        expect(after.netWorth).toBe(before.netWorth - 12_000);
        expect(after.liabilities).toBe(12_000);
    });
});

describe("accounting invariants", () => {
    it("keeps each liability balance equal to its outstanding bills", () => {
        const data = buildFixture();
        const credit = data.accounts.find((account) => account.id === "acc_credit")!;

        expect(getAccountBalance(credit, data.entries)).toBe(
            getOutstandingTotal(data.bills, data.entries),
        );

        data.entries.push({
            id: "entry_repay_invariant",
            kind: "repayment",
            amount: 7_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            createdAt: NOW,
        });
        expect(getAccountBalance(credit, data.entries)).toBe(
            getOutstandingTotal(data.bills, data.entries),
        );

        const secondBill: Bill = {
            ...data.bills[0],
            id: "bill_2",
            title: "第二笔赊账",
            principal: 8_000,
        };
        data.bills.push(secondBill);
        data.entries.push({
            id: "entry_credit_2",
            kind: "expense",
            amount: 8_000,
            date: NOW,
            liabilityAccountId: "acc_credit",
            billId: secondBill.id,
            categoryId: "cat_food",
            createdAt: NOW,
        });
        expect(getAccountBalance(credit, data.entries)).toBe(
            getOutstandingTotal(data.bills, data.entries),
        );
    });

    it("reconciles net worth with income, cash expense and debt", () => {
        const data = buildFixture();
        const initial = getTotals({
            accounts: data.accounts,
            entries: [],
        });
        const beforeRepayment = getTotals(data);
        const month = getMonthTotals(data.entries, NOW);
        const creditPurchases = data.entries
            .filter(
                (entry) =>
                    entry.kind === "expense" && Boolean(entry.liabilityAccountId),
            )
            .reduce((sum, entry) => sum + entry.amount, 0);

        expect(beforeRepayment.netWorth - initial.netWorth).toBe(
            month.income - month.expense - creditPurchases,
        );

        data.entries.push({
            id: "entry_repay_neutral",
            kind: "repayment",
            amount: 20_000,
            date: NOW,
            accountId: "acc_bank",
            liabilityAccountId: "acc_credit",
            billId: "bill_1",
            createdAt: NOW,
        });
        data.entries.push({
            id: "entry_transfer_neutral",
            kind: "transfer",
            amount: 9_000,
            date: NOW,
            accountId: "acc_cash",
            toAccountId: "acc_bank",
            createdAt: NOW,
        });

        const afterRepayment = getTotals(data);
        expect(afterRepayment.netWorth).toBe(beforeRepayment.netWorth);
        const afterMonth = getMonthTotals(data.entries, NOW);
        expect(afterRepayment.netWorth - initial.netWorth).toBe(
            afterMonth.income - afterMonth.expense,
        );
    });
});

describe("summaries", () => {
    it("computes month totals and category shares", () => {
        const data = buildFixture();
        const totals = getMonthTotals(data.entries, NOW);
        expect(totals.expense).toBe(10_000);
        expect(totals.income).toBe(50_000);
        expect(totals.net).toBe(40_000);

        const breakdown = getCategoryBreakdown(data.entries, data.categories, NOW);
        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].name).toBe("餐饮");
        expect(breakdown[0].amount).toBe(10_000);
        expect(breakdown[0].share).toBe(1);
    });

    it("sorts open bills by due date and totals the outstanding amount", () => {
        const data = buildFixture();
        const later: Bill = {
            ...data.bills[0],
            id: "bill_later",
            dueDate: new Date(2026, 11, 1, 12).getTime(),
    };
        data.bills.push(later);

        expect(getOpenBills(data.bills, data.entries).map((bill) => bill.id)).toEqual([
            "bill_1",
            "bill_later",
        ]);
        expect(getOutstandingTotal(data.bills, data.entries)).toBe(40_000);
    });

    it("labels overdue and upcoming bills", () => {
        const data = buildFixture();
        const bill = data.bills[0];

        const overdue = getBillDueInfo(
            { ...bill, dueDate: new Date(2026, 9, 20, 12).getTime() },
            "open",
            NOW,
        );
        expect(overdue.tone).toBe("danger");
        expect(overdue.label).toContain("逾期");

        const soon = getBillDueInfo(
            { ...bill, dueDate: new Date(2026, 10, 2, 12).getTime() },
            "open",
            NOW,
        );
        expect(soon.tone).toBe("warning");
        expect(soon.label).toContain("天后");
    });
});
