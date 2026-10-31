/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import type {
    Account,
    AccountKind,
    Bill,
    Book,
    Category,
    CategoryKind,
    Entry,
    LedgerData,
    Member,
    Settings,
    ThemeMode,
} from "@/types";
import { createSeedData } from "@/domain/seed";
import {
    getBillRepaid,
    getBillRemaining,
    getLinkedExpense,
    validateRepayment,
} from "@/domain/ledger";
import { getActiveBook, useLibraryStore } from "@/store/library";
import { newId } from "@/utils/id";

export type Result = { ok: true } | { ok: false; error: string };
export type AddExpenseResult = { ok: true; billId?: string } | { ok: false; error: string };

export interface ExpenseInput {
    amount: number;
    date: number;
    categoryId: string;
    memberId?: string;
    note?: string;
    source:
        | { type: "asset"; accountId: string }
        | {
              type: "liability";
              accountId: string;
              title?: string;
              dueDate?: number;
          };
}

export interface IncomeInput {
    amount: number;
    date: number;
    categoryId: string;
    accountId: string;
    memberId?: string;
    note?: string;
}

export interface RepaymentInput {
    amount: number;
    date: number;
    billId: string;
    accountId: string;
    memberId?: string;
    note?: string;
}

export interface AccountInput {
    name: string;
    kind: AccountKind;
    emoji: string;
    openingBalance: number;
    liquid?: boolean;
    note?: string;
}

export interface CategoryInput {
    name: string;
    kind: CategoryKind;
    emoji: string;
    color: string;
}

export interface LedgerActions {
    addExpense: (input: ExpenseInput) => AddExpenseResult;
    addIncome: (input: IncomeInput) => Result;
    addRepayment: (input: RepaymentInput) => Result;
    deleteEntry: (entryId: string) => Result;
    deleteBill: (billId: string) => Result;
    updateBill: (
        billId: string,
        patch: Partial<Pick<Bill, "title" | "dueDate" | "note" | "categoryId" | "memberId">>,
    ) => Result;
    addMember: (input: { name: string; color: string }) => Result & { id?: string };
    updateMember: (
        memberId: string,
        patch: Partial<Pick<Member, "name" | "color">>,
    ) => Result;
    deleteMember: (memberId: string) => Result;
    addAccount: (input: AccountInput) => Result & { id?: string };
    updateAccount: (
        accountId: string,
        patch: Partial<Pick<Account, "name" | "emoji" | "note" | "liquid">>,
    ) => Result;
    deleteAccount: (accountId: string) => Result;
    addCategory: (input: CategoryInput) => Result & { id?: string };
    updateCategory: (
        categoryId: string,
        patch: Partial<Pick<Category, "name" | "emoji" | "color">>,
    ) => Result;
    deleteCategory: (categoryId: string) => Result;
    setSettings: (patch: Partial<Settings>) => void;
    importData: (data: LedgerData) => Result;
    resetData: () => void;
}

export type LedgerState = Book & LedgerActions;

function cleanNote(note?: string): string | undefined {
    const value = note?.trim();
    return value ? value : undefined;
}

function isPositiveInteger(value: number): boolean {
    return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
}

function isValidDate(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function fail(error: string): { ok: false; error: string } {
    return { ok: false, error };
}

const createActions = (
    set: (partial: Partial<LedgerState> | ((state: LedgerState) => Partial<LedgerState>)) => void,
    get: () => LedgerState,
): LedgerActions => ({
    addExpense(input) {
        if (!isPositiveInteger(input.amount)) {
            return fail("金额必须大于 0");
        }
        if (!isValidDate(input.date)) {
            return fail("请选择有效日期");
        }

        const state = get();
        const category = state.categories.find((item) => item.id === input.categoryId);
        if (!category || category.kind !== "expense") {
            return fail("请选择支出分类");
        }
        const memberId = input.memberId ?? state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }

        const createdAt = Date.now();
        const note = cleanNote(input.note);

        if (input.source.type === "asset") {
            const account = state.accounts.find((item) => item.id === input.source.accountId);
            if (!account || account.kind !== "asset") {
                return fail("请选择储蓄账户");
            }

            const entry: Entry = {
                id: newId("entry"),
                kind: "expense",
                amount: input.amount,
                date: input.date,
                accountId: account.id,
                categoryId: category.id,
                memberId,
                note,
                createdAt,
            };
            set({ entries: [...state.entries, entry] });
            return { ok: true };
        }

        const liability = state.accounts.find((item) => item.id === input.source.accountId);
        if (!liability || liability.kind !== "liability") {
            return fail("请选择负债账户");
        }
        if (input.source.dueDate !== undefined && !isValidDate(input.source.dueDate)) {
            return fail("请选择有效到期日");
        }

        const billId = newId("bill");
        const bill: Bill = {
            id: billId,
            liabilityAccountId: liability.id,
            categoryId: category.id,
            memberId,
            title: input.source.title?.trim() || category.name,
            principal: input.amount,
            purchasedAt: input.date,
            dueDate: input.source.dueDate,
            note,
            createdAt,
        };
        const entry: Entry = {
            id: newId("entry"),
            kind: "expense",
            amount: input.amount,
            date: input.date,
            liabilityAccountId: liability.id,
            billId,
            categoryId: category.id,
            memberId,
            note,
            createdAt,
        };

        set({
            bills: [...state.bills, bill],
            entries: [...state.entries, entry],
        });
        return { ok: true, billId };
    },

    addIncome(input) {
        if (!isPositiveInteger(input.amount)) {
            return fail("金额必须大于 0");
        }
        if (!isValidDate(input.date)) {
            return fail("请选择有效日期");
        }

        const state = get();
        const category = state.categories.find((item) => item.id === input.categoryId);
        if (!category || category.kind !== "income") {
            return fail("请选择收入分类");
        }
        const account = state.accounts.find((item) => item.id === input.accountId);
        if (!account || account.kind !== "asset") {
            return fail("请选择收款账户");
        }
        const memberId = input.memberId ?? state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }

        const entry: Entry = {
            id: newId("entry"),
            kind: "income",
            amount: input.amount,
            date: input.date,
            accountId: account.id,
            categoryId: category.id,
            memberId,
            note: cleanNote(input.note),
            createdAt: Date.now(),
        };
        set({ entries: [...state.entries, entry] });
        return { ok: true };
    },

    addRepayment(input) {
        if (!isValidDate(input.date)) {
            return fail("请选择有效日期");
        }

        const state = get();
        const bill = state.bills.find((item) => item.id === input.billId);
        if (!bill) {
            return fail("账单不存在");
        }
        const account = state.accounts.find((item) => item.id === input.accountId);
        const error = validateRepayment(bill, state.entries, input.amount, account);
        if (error) {
            return fail(error);
        }
        const memberId = input.memberId ?? bill.memberId ?? state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }

        const entry: Entry = {
            id: newId("entry"),
            kind: "repayment",
            amount: input.amount,
            date: input.date,
            accountId: input.accountId,
            liabilityAccountId: bill.liabilityAccountId,
            billId: bill.id,
            memberId,
            note: cleanNote(input.note),
            createdAt: Date.now(),
        };
        set({ entries: [...state.entries, entry] });
        return { ok: true };
    },

    deleteEntry(entryId) {
        const state = get();
        const entry = state.entries.find((item) => item.id === entryId);
        if (!entry) {
            return fail("流水不存在");
        }

        if (entry.kind === "expense" && entry.billId) {
            const bill = state.bills.find((item) => item.id === entry.billId);
            if (!bill) {
                set({ entries: state.entries.filter((item) => item.id !== entryId) });
                return { ok: true };
            }
            if (bill.opening) {
                return fail("期初负债不能直接删除");
            }
            if (getBillRepaid(bill.id, state.entries) > 0) {
                return fail("这笔赊账已有还款记录，请先删除对应的还款");
            }
            set({
                entries: state.entries.filter((item) => item.id !== entryId),
                bills: state.bills.filter((item) => item.id !== bill.id),
            });
            return { ok: true };
        }

        set({ entries: state.entries.filter((item) => item.id !== entryId) });
        return { ok: true };
    },

    deleteBill(billId) {
        const state = get();
        const bill = state.bills.find((item) => item.id === billId);
        if (!bill) {
            return fail("账单不存在");
        }
        if (bill.opening) {
            return fail("期初负债不能删除，请通过还款结清");
        }
        if (getBillRepaid(bill.id, state.entries) > 0) {
            return fail("这笔账单已有还款记录，请先删除对应的还款");
        }

        const linkedExpense = getLinkedExpense(bill.id, state.entries);
        set({
            bills: state.bills.filter((item) => item.id !== bill.id),
            entries: linkedExpense
                ? state.entries.filter((item) => item.id !== linkedExpense.id)
                : state.entries,
        });
        return { ok: true };
    },

    updateBill(billId, patch) {
        const state = get();
        const bill = state.bills.find((item) => item.id === billId);
        if (!bill) {
            return fail("账单不存在");
        }
        if (patch.title !== undefined && patch.title.trim() === "") {
            return fail("账单名称不能为空");
        }
        if (patch.dueDate !== undefined && !isValidDate(patch.dueDate)) {
            return fail("请选择有效到期日");
        }
        const nextCategoryId =
            patch.categoryId === undefined || patch.categoryId === ""
                ? undefined
                : patch.categoryId;
        if (nextCategoryId !== undefined) {
            const category = state.categories.find((item) => item.id === nextCategoryId);
            if (!category || category.kind !== "expense") {
                return fail("请选择支出分类");
            }
        }
        const nextMemberId =
            patch.memberId === undefined || patch.memberId === ""
                ? undefined
                : patch.memberId;
        if (
            nextMemberId !== undefined &&
            !state.members.some((member) => member.id === nextMemberId)
        ) {
            return fail("请选择成员");
        }

        const updateEntries = patch.categoryId !== undefined || patch.memberId !== undefined;

        set({
            bills: state.bills.map((item) =>
                item.id === billId
                    ? {
                          ...item,
                          ...patch,
                          title: patch.title?.trim() ?? item.title,
                          note: patch.note !== undefined ? cleanNote(patch.note) : item.note,
                          categoryId:
                              patch.categoryId !== undefined
                                  ? nextCategoryId
                                  : item.categoryId,
                          memberId:
                              patch.memberId !== undefined
                                  ? nextMemberId
                                  : item.memberId,
                      }
                    : item,
            ),
            entries: updateEntries
                ? state.entries.map((entry) =>
                      entry.billId === billId && entry.kind === "expense"
                          ? {
                                ...entry,
                                ...(patch.categoryId !== undefined
                                    ? { categoryId: nextCategoryId }
                                    : {}),
                                ...(patch.memberId !== undefined
                                    ? { memberId: nextMemberId }
                                    : {}),
                            }
                          : entry,
                  )
                : state.entries,
        });
        return { ok: true };
    },

    addAccount(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("账户名称不能为空");
        }
        if (!isNonNegativeInteger(input.openingBalance)) {
            return fail("期初余额必须是非负整数");
        }

        const state = get();
        const createdAt = Date.now();
        const account: Account = {
            id: newId("acc"),
            name,
            kind: input.kind,
            emoji: input.emoji.trim() || (input.kind === "liability" ? "💳" : "💵"),
            openingBalance: input.openingBalance,
            liquid: input.kind === "asset" ? (input.liquid ?? true) : undefined,
            note: cleanNote(input.note),
            createdAt,
        };

        let openingBill: Bill | undefined;
        if (input.kind === "liability" && input.openingBalance > 0) {
            openingBill = {
                id: newId("bill"),
                liabilityAccountId: account.id,
                memberId: state.members[0]?.id,
                title: "期初负债",
                principal: input.openingBalance,
                purchasedAt: createdAt,
                note: "创建账户时带入的期初余额",
                opening: true,
                createdAt,
            };
        }

        set({
            accounts: [...state.accounts, account],
            bills: openingBill ? [...state.bills, openingBill] : state.bills,
        });
        return { ok: true, id: account.id };
    },

    updateAccount(accountId, patch) {
        const state = get();
        const account = state.accounts.find((item) => item.id === accountId);
        if (!account) {
            return fail("账户不存在");
        }
        if (patch.name !== undefined && patch.name.trim() === "") {
            return fail("账户名称不能为空");
        }
        set({
            accounts: state.accounts.map((item) =>
                item.id === accountId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          emoji: patch.emoji?.trim() || item.emoji,
                          liquid:
                              item.kind === "asset" && patch.liquid !== undefined
                                  ? patch.liquid
                                  : item.liquid,
                          note: patch.note !== undefined ? cleanNote(patch.note) : item.note,
                      }
                    : item,
            ),
        });
        return { ok: true };
    },

    deleteAccount(accountId) {
        const state = get();
        const account = state.accounts.find((item) => item.id === accountId);
        if (!account) {
            return fail("账户不存在");
        }
        const usedByEntry = state.entries.some(
            (entry) => entry.accountId === accountId || entry.liabilityAccountId === accountId,
        );
        const usedByBill = state.bills.some((bill) => bill.liabilityAccountId === accountId);
        if (usedByEntry || usedByBill) {
            return fail("该账户已有流水或账单，不能删除");
        }
        set({ accounts: state.accounts.filter((item) => item.id !== accountId) });
        return { ok: true };
    },

    addCategory(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("分类名称不能为空");
        }
        const state = get();
        const category: Category = {
            id: newId("cat"),
            name,
            kind: input.kind,
            emoji: input.emoji.trim() || "📦",
            color: input.color || "#a8a29e",
            createdAt: Date.now(),
        };
        set({ categories: [...state.categories, category] });
        return { ok: true, id: category.id };
    },

    updateCategory(categoryId, patch) {
        const state = get();
        const category = state.categories.find((item) => item.id === categoryId);
        if (!category) {
            return fail("分类不存在");
        }
        if (patch.name !== undefined && patch.name.trim() === "") {
            return fail("分类名称不能为空");
        }
        set({
            categories: state.categories.map((item) =>
                item.id === categoryId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          emoji: patch.emoji?.trim() || item.emoji,
                      }
                    : item,
            ),
        });
        return { ok: true };
    },

    deleteCategory(categoryId) {
        const state = get();
        const category = state.categories.find((item) => item.id === categoryId);
        if (!category) {
            return fail("分类不存在");
        }
        const used = state.entries.some((entry) => entry.categoryId === categoryId);
        const usedByBill = state.bills.some((bill) => bill.categoryId === categoryId);
        if (used || usedByBill) {
            return fail("该分类已有流水或账单，不能删除");
        }
        set({ categories: state.categories.filter((item) => item.id !== categoryId) });
        return { ok: true };
    },

    addMember(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("成员名称不能为空");
        }
        const state = get();
        const member: Member = {
            id: newId("member"),
            name,
            color: input.color || "#0f766e",
            createdAt: Date.now(),
        };
        set({ members: [...state.members, member] });
        return { ok: true, id: member.id };
    },

    updateMember(memberId, patch) {
        const state = get();
        const member = state.members.find((item) => item.id === memberId);
        if (!member) {
            return fail("成员不存在");
        }
        if (patch.name !== undefined && patch.name.trim() === "") {
            return fail("成员名称不能为空");
        }
        set({
            members: state.members.map((item) =>
                item.id === memberId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          color: patch.color || item.color,
                      }
                    : item,
            ),
        });
        return { ok: true };
    },

    deleteMember(memberId) {
        const state = get();
        const member = state.members.find((item) => item.id === memberId);
        if (!member) {
            return fail("成员不存在");
        }
        if (state.members.length <= 1) {
            return fail("至少保留一个成员");
        }
        const usedByEntry = state.entries.some((entry) => entry.memberId === memberId);
        const usedByBill = state.bills.some((bill) => bill.memberId === memberId);
        if (usedByEntry || usedByBill) {
            return fail("该成员已有流水或账单，不能删除");
        }
        set({ members: state.members.filter((item) => item.id !== memberId) });
        return { ok: true };
    },

    setSettings(patch) {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
    },

    importData(data) {
        if (!data.accounts.length) {
            return fail("导入文件里没有账户");
        }
        set({
            accounts: data.accounts,
            categories: data.categories,
            members: data.members,
            bills: data.bills,
            entries: data.entries,
            settings: data.settings,
        });
        return { ok: true };
    },

    resetData() {
        set(createSeedData());
    },
});

const initialBook = getActiveBook(useLibraryStore.getState());

export function extractBook(state: LedgerState): Book {
    return {
        id: state.id,
        name: state.name,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        accounts: state.accounts,
        categories: state.categories,
        members: state.members,
        bills: state.bills,
        entries: state.entries,
        settings: state.settings,
        remote: state.remote,
    };
}

export const useLedgerStore = create<LedgerState>()((set, get) => {
    const setAndSync = (
        partial:
            | Partial<LedgerState>
            | ((state: LedgerState) => Partial<LedgerState>),
    ) => {
        const patch = typeof partial === "function" ? partial(get()) : partial;
        set({ ...patch, updatedAt: Date.now() });
        useLibraryStore.getState().upsertBook(extractBook(get()));
    };

    return {
        ...initialBook,
        ...createActions(setAndSync, get),
    };
});

export function useCurrency(): string {
    return useLedgerStore((state) => state.settings.currency);
}

export function useTheme(): ThemeMode {
    return useLedgerStore((state) => state.settings.theme);
}

export function getAccountName(accounts: Account[], accountId?: string): string {
    if (!accountId) {
        return "未指定账户";
    }
    return accounts.find((account) => account.id === accountId)?.name ?? "已删除账户";
}

export function getCategoryName(categories: Category[], categoryId?: string): string {
    if (!categoryId) {
        return "未分类";
    }
    return categories.find((category) => category.id === categoryId)?.name ?? "未分类";
}

export function getBillRemainingForState(bill: Bill, state: LedgerData): number {
    return getBillRemaining(bill, state.entries);
}
