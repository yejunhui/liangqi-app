/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import type {
    Account,
    AccountKind,
    Actor,
    Attachment,
    Bill,
    Book,
    Budget,
    BudgetPeriod,
    Category,
    CategoryKind,
    Entry,
    EntryLocation,
    LedgerData,
    Member,
    OriginalAmount,
    RecurringFrequency,
    RecurringRule,
    Settings,
    Tag,
    TagGroup,
    ThemeMode,
    Tombstone,
} from "@/types";
import { createSeedData } from "@/domain/seed";
import { createDefaultTagGroups, createDefaultTags, seedDefaultTags } from "@/domain/tags";
import {
    getBillRepaid,
    getBillRemaining,
    getLinkedExpense,
    validateRepayment,
} from "@/domain/ledger";
import { getActiveBook, useLibraryStore } from "@/store/library";
import { getActiveMember, canModifyOwner } from "@/store/member-session";
import { advanceRecurringDate } from "@/domain/recurring";
import { newId } from "@/utils/id";

export type Result = { ok: true } | { ok: false; error: string };
export type AddEntryResult =
    | { ok: true; entryId: string; billId?: string }
    | { ok: false; error: string };

export interface ExpenseInput {
    amount: number;
    date: number;
    categoryId: string;
    memberId?: string;
    tagIds?: string[];
    location?: EntryLocation;
    originalAmount?: OriginalAmount;
    note?: string;
    recurringId?: string;
    actor?: Actor;
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
    tagIds?: string[];
    location?: EntryLocation;
    originalAmount?: OriginalAmount;
    note?: string;
    recurringId?: string;
    actor?: Actor;
}

export interface RepaymentInput {
    amount: number;
    date: number;
    billId: string;
    accountId: string;
    memberId?: string;
    tagIds?: string[];
    location?: EntryLocation;
    originalAmount?: OriginalAmount;
    note?: string;
}

export interface TransferInput {
    amount: number;
    date: number;
    fromAccountId: string;
    toAccountId: string;
    memberId?: string;
    tagIds?: string[];
    location?: EntryLocation;
    originalAmount?: OriginalAmount;
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
    parent?: string;
}

export interface TagGroupInput {
    name: string;
    selection: "single" | "multiple";
}

export interface TagInput {
    name: string;
    color: string;
    groupId?: string;
}

export interface BudgetInput {
    name: string;
    period: BudgetPeriod;
    amount: number;
    categoryIds?: string[];
    tagIds?: string[];
    memberIds?: string[];
}

export interface RecurringInput {
    name: string;
    kind: "expense" | "income";
    amount: number;
    frequency: RecurringFrequency;
    interval: number;
    startDate: number;
    endDate?: number;
    categoryId: string;
    accountId?: string;
    liabilityAccountId?: string;
    memberId?: string;
    tagIds?: string[];
    note?: string;
}

export interface BulkEntryPatch {
    categoryId?: string;
    memberId?: string;
    tagIds?: string[];
    note?: string;
}

export interface LedgerActions {
    addExpense: (input: ExpenseInput) => AddEntryResult;
    addIncome: (input: IncomeInput) => AddEntryResult;
    addRepayment: (input: RepaymentInput) => AddEntryResult;
    addTransfer: (input: TransferInput) => AddEntryResult;
    deleteEntry: (entryId: string) => Result;
    bulkUpdateEntries: (entryIds: string[], patch: BulkEntryPatch) => Result;
    deleteBill: (billId: string) => Result;
    updateBill: (
        billId: string,
        patch: Partial<
            Pick<Bill, "title" | "dueDate" | "note" | "categoryId" | "memberId" | "tagIds">
        >,
    ) => Result;
    addMember: (input: {
        name: string;
        color: string;
        pinHash?: string;
        pinSalt?: string;
        pinIterations?: number;
    }) => Result & { id?: string };
    updateMember: (
        memberId: string,
        patch: Partial<
            Pick<
                Member,
                "name" | "color" | "pinHash" | "pinSalt" | "pinIterations"
            >
        >,
    ) => Result;
    deleteMember: (memberId: string) => Result;
    addTagGroup: (input: TagGroupInput) => Result & { id?: string };
    updateTagGroup: (
        groupId: string,
        patch: Partial<Pick<TagGroup, "name" | "selection">>,
    ) => Result;
    deleteTagGroup: (groupId: string) => Result;
    addTag: (input: TagInput) => Result & { id?: string };
    updateTag: (
        tagId: string,
        patch: Partial<Pick<Tag, "name" | "color" | "groupId">>,
    ) => Result;
    deleteTag: (tagId: string) => Result;
    addDefaultTags: () => Result & { count?: number };
    addBudget: (input: BudgetInput) => Result & { id?: string };
    updateBudget: (
        budgetId: string,
        patch: Partial<Pick<Budget, "name" | "period" | "amount" | "categoryIds" | "tagIds" | "memberIds">>,
    ) => Result;
    deleteBudget: (budgetId: string) => Result;
    addRecurringRule: (input: RecurringInput) => Result & { id?: string };
    updateRecurringRule: (
        ruleId: string,
        patch: Partial<
            Pick<
                RecurringRule,
                | "name"
                | "amount"
                | "frequency"
                | "interval"
                | "startDate"
                | "nextDueDate"
                | "endDate"
                | "enabled"
                | "categoryId"
                | "accountId"
                | "liabilityAccountId"
                | "memberId"
                | "tagIds"
                | "note"
            >
        >,
    ) => Result;
    deleteRecurringRule: (ruleId: string) => Result;
    postDueRecurring: (now?: number) => Result & { posted?: number };
    addAttachments: (
        target: { kind: "entry" | "bill"; id: string },
        items: Attachment[],
    ) => Result;
    deleteAttachment: (attachmentId: string) => Result;
    addAccount: (input: AccountInput) => Result & { id?: string };
    updateAccount: (
        accountId: string,
        patch: Partial<Pick<Account, "name" | "emoji" | "note" | "liquid">>,
    ) => Result;
    deleteAccount: (accountId: string) => Result;
    addCategory: (input: CategoryInput) => Result & { id?: string };
    updateCategory: (
        categoryId: string,
        patch: Partial<Pick<Category, "name" | "emoji" | "color" | "parent">>,
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

function tombstone(list: Tombstone[], id: string, ownerId?: string): Tombstone[] {
    return [
        ...list.filter((item) => item.id !== id),
        { id, deletedAt: Date.now(), ownerId },
    ];
}

function canModify(record: { ownerId?: string }): boolean {
    return canModifyOwner(record.ownerId);
}

function actorFields(actor: Actor, at: number) {
    return {
        ownerId: actor.id,
        ownerName: actor.name,
        updatedAt: at,
    };
}

function cleanTagIds(
    tagIds: string[] | undefined,
    tags: Tag[],
): { ok: true; tagIds: string[] } | { ok: false; error: string } {
    if (!tagIds || tagIds.length === 0) {
        return { ok: true, tagIds: [] };
    }
    const ids = [...new Set(tagIds)];
    if (ids.some((id) => !tags.some((tag) => tag.id === id))) {
        return { ok: false, error: "标签不存在" };
    }
    return { ok: true, tagIds: ids };
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
        const memberId = input.memberId ?? getActiveMember()?.id ?? state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }
        const tagResult = cleanTagIds(input.tagIds, state.tags);
        if (!tagResult.ok) {
            return fail(tagResult.error);
        }
        const tagIds = tagResult.tagIds;

        const createdAt = Date.now();
        const actor = input.actor ?? getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }
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
                tagIds,
                note,
                recurringId: input.recurringId,
                location: input.location,
                originalAmount: input.originalAmount,
                ...actorFields(actor, createdAt),
                createdAt,
            };
            set({ entries: [...state.entries, entry] });
            return { ok: true, entryId: entry.id };
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
            tagIds,
            title: input.source.title?.trim() || category.name,
            principal: input.amount,
            purchasedAt: input.date,
            dueDate: input.source.dueDate,
            note,
            originalAmount: input.originalAmount,
            ...actorFields(actor, createdAt),
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
            tagIds,
            note,
            recurringId: input.recurringId,
            location: input.location,
            originalAmount: input.originalAmount,
            ...actorFields(actor, createdAt),
            createdAt,
        };

        set({
            bills: [...state.bills, bill],
            entries: [...state.entries, entry],
        });
        return { ok: true, billId, entryId: entry.id };
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
        const memberId = input.memberId ?? getActiveMember()?.id ?? state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }
        const tagResult = cleanTagIds(input.tagIds, state.tags);
        if (!tagResult.ok) {
            return fail(tagResult.error);
        }

        const actor = input.actor ?? getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }
        const createdAt = Date.now();

        const entry: Entry = {
            id: newId("entry"),
            kind: "income",
            amount: input.amount,
            date: input.date,
            accountId: account.id,
            categoryId: category.id,
            memberId,
            tagIds: tagResult.tagIds,
            note: cleanNote(input.note),
            recurringId: input.recurringId,
            location: input.location,
            originalAmount: input.originalAmount,
            ...actorFields(actor, createdAt),
            createdAt,
        };
        set({ entries: [...state.entries, entry] });
        return { ok: true, entryId: entry.id };
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
        const memberId =
            input.memberId ??
            bill.memberId ??
            getActiveMember()?.id ??
            state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }
        const tagResult = cleanTagIds(input.tagIds, state.tags);
        if (!tagResult.ok) {
            return fail(tagResult.error);
        }
        const actor = getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }

        const entry: Entry = {
            id: newId("entry"),
            kind: "repayment",
            amount: input.amount,
            date: input.date,
            accountId: input.accountId,
            liabilityAccountId: bill.liabilityAccountId,
            billId: bill.id,
            categoryId: bill.categoryId,
            memberId,
            tagIds: tagResult.tagIds,
            note: cleanNote(input.note),
            location: input.location,
            originalAmount: input.originalAmount,
            ...actorFields(actor, Date.now()),
            createdAt: Date.now(),
        };
        set({ entries: [...state.entries, entry] });
        return { ok: true, entryId: entry.id };
    },

    addTransfer(input) {
        if (!isPositiveInteger(input.amount)) {
            return fail("金额必须大于 0");
        }
        if (!isValidDate(input.date)) {
            return fail("请选择有效日期");
        }
        const state = get();
        const from = state.accounts.find((item) => item.id === input.fromAccountId);
        const to = state.accounts.find((item) => item.id === input.toAccountId);
        if (!from || from.kind !== "asset" || !to || to.kind !== "asset") {
            return fail("请选择两个储蓄账户");
        }
        if (from.id === to.id) {
            return fail("转出账户和转入账户不能相同");
        }
        const memberId = input.memberId ?? getActiveMember()?.id ?? state.members[0]?.id;
        if (!memberId || !state.members.some((member) => member.id === memberId)) {
            return fail("请选择成员");
        }
        const tagResult = cleanTagIds(input.tagIds, state.tags);
        if (!tagResult.ok) {
            return fail(tagResult.error);
        }
        const actor = getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }
        const entry: Entry = {
            id: newId("entry"),
            kind: "transfer",
            amount: input.amount,
            date: input.date,
            accountId: from.id,
            toAccountId: to.id,
            memberId,
            tagIds: tagResult.tagIds,
            note: cleanNote(input.note),
            location: input.location,
            originalAmount: input.originalAmount,
            ...actorFields(actor, Date.now()),
            createdAt: Date.now(),
        };
        set({ entries: [...state.entries, entry] });
        return { ok: true, entryId: entry.id };
    },

    deleteEntry(entryId) {
        const state = get();
        const entry = state.entries.find((item) => item.id === entryId);
        if (!entry) {
            return fail("流水不存在");
        }
        if (!canModify(entry)) {
            return fail("不能修改其他成员的记账");
        }
        const deletedAt = Date.now();
        const actor = getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }
        const entryTombstones = [
            ...state.deletedEntries.filter((item) => item.id !== entryId),
            { id: entryId, deletedAt, ownerId: actor.id },
        ];

        if (entry.kind === "expense" && entry.billId) {
            const bill = state.bills.find((item) => item.id === entry.billId);
            if (!bill) {
                set({
                    entries: state.entries.filter((item) => item.id !== entryId),
                    deletedEntries: entryTombstones,
                });
                return { ok: true };
            }
            if (!canModify(bill)) {
                return fail("不能修改其他成员的账单");
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
                deletedEntries: entryTombstones,
                deletedBills: [
                    ...state.deletedBills.filter((item) => item.id !== bill.id),
                    { id: bill.id, deletedAt, ownerId: actor.id },
                ],
            });
            return { ok: true };
        }

        set({
            entries: state.entries.filter((item) => item.id !== entryId),
            deletedEntries: entryTombstones,
        });
        return { ok: true };
    },

    bulkUpdateEntries(entryIds, patch) {
        const ids = [...new Set(entryIds)];
        if (ids.length === 0) {
            return fail("请选择流水");
        }
        const state = get();
        const items = state.entries.filter((entry) => ids.includes(entry.id));
        if (items.length !== ids.length) {
            return fail("部分流水不存在");
        }
        if (items.some((entry) => !canModify(entry))) {
            return fail("包含其他成员的记账，不能批量修改");
        }
        if (patch.memberId !== undefined) {
            if (!state.members.some((member) => member.id === patch.memberId)) {
                return fail("请选择成员");
            }
        }
        const tagResult =
            patch.tagIds === undefined
                ? null
                : cleanTagIds(patch.tagIds, state.tags);
        if (tagResult && !tagResult.ok) {
            return fail(tagResult.error);
        }
        let category: Category | undefined;
        if (patch.categoryId !== undefined) {
            category = state.categories.find((item) => item.id === patch.categoryId);
            if (!category) {
                return fail("分类不存在");
            }
            for (const entry of items) {
                if (entry.kind !== "expense" && entry.kind !== "income") {
                    return fail("转账和还款流水不能修改分类");
                }
                if (entry.kind !== category.kind) {
                    return fail("所选流水的类型和分类不一致");
                }
            }
        }

        const changedAt = Date.now();
        const changedFields = (
            ["categoryId", "memberId", "tagIds", "note"] as const
        ).filter((key) => patch[key] !== undefined);
        const fieldTimes = Object.fromEntries(
            changedFields.map((key) => [key, changedAt]),
        );
        const affectedBillIds = new Set(
            state.entries
                .filter(
                    (entry) =>
                        ids.includes(entry.id) &&
                        entry.kind === "expense" &&
                        entry.billId,
                )
                .map((entry) => entry.billId!),
        );
        set({
            entries: state.entries.map((entry) => {
                if (!ids.includes(entry.id)) {
                    if (
                        category &&
                        entry.kind === "repayment" &&
                        entry.billId &&
                        affectedBillIds.has(entry.billId)
                    ) {
                        return {
                            ...entry,
                            categoryId: category.id,
                            updatedAt: changedAt,
                            fieldUpdatedAt: {
                                ...entry.fieldUpdatedAt,
                                categoryId: changedAt,
                            },
                        };
                    }
                    return entry;
                }
                return {
                    ...entry,
                    ...(category ? { categoryId: category.id } : {}),
                    ...(patch.memberId !== undefined
                        ? { memberId: patch.memberId }
                        : {}),
                    ...(tagResult ? { tagIds: tagResult.tagIds } : {}),
                    ...(patch.note !== undefined
                        ? { note: cleanNote(patch.note) }
                        : {}),
                    updatedAt: changedAt,
                    fieldUpdatedAt: {
                        ...entry.fieldUpdatedAt,
                        ...fieldTimes,
                    },
                };
            }),
            bills: state.bills.map((bill) => {
                const linked = state.entries.find(
                    (entry) =>
                        ids.includes(entry.id) &&
                        entry.kind === "expense" &&
                        entry.billId === bill.id,
                );
                if (!linked) {
                    return bill;
                }
                return {
                    ...bill,
                    ...(category ? { categoryId: category.id } : {}),
                    ...(patch.memberId !== undefined
                        ? { memberId: patch.memberId }
                        : {}),
                    ...(tagResult ? { tagIds: tagResult.tagIds } : {}),
                    updatedAt: changedAt,
                    fieldUpdatedAt: {
                        ...bill.fieldUpdatedAt,
                        ...fieldTimes,
                    },
                };
            }),
        });
        return { ok: true };
    },

    deleteBill(billId) {
        const state = get();
        const bill = state.bills.find((item) => item.id === billId);
        if (!bill) {
            return fail("账单不存在");
        }
        if (!canModify(bill)) {
            return fail("不能修改其他成员的账单");
        }
        if (bill.opening) {
            return fail("期初负债不能删除，请通过还款结清");
        }
        if (getBillRepaid(bill.id, state.entries) > 0) {
            return fail("这笔账单已有还款记录，请先删除对应的还款");
        }

        const linkedExpense = getLinkedExpense(bill.id, state.entries);
        if (linkedExpense && !canModify(linkedExpense)) {
            return fail("不能修改其他成员的记账");
        }
        const deletedAt = Date.now();
        const actor = getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }
        set({
            bills: state.bills.filter((item) => item.id !== bill.id),
            entries: linkedExpense
                ? state.entries.filter((item) => item.id !== linkedExpense.id)
                : state.entries,
            deletedBills: [
                ...state.deletedBills.filter((item) => item.id !== bill.id),
                { id: bill.id, deletedAt, ownerId: actor.id },
            ],
            deletedEntries: linkedExpense
                ? [
                      ...state.deletedEntries.filter(
                          (item) => item.id !== linkedExpense.id,
                      ),
                      { id: linkedExpense.id, deletedAt, ownerId: actor.id },
                  ]
                : state.deletedEntries,
        });
        return { ok: true };
    },

    updateBill(billId, patch) {
        const state = get();
        const bill = state.bills.find((item) => item.id === billId);
        if (!bill) {
            return fail("账单不存在");
        }
        if (!canModify(bill)) {
            return fail("不能修改其他成员的账单");
        }
        const linkedExpense = getLinkedExpense(bill.id, state.entries);
        if (linkedExpense && !canModify(linkedExpense)) {
            return fail("不能修改其他成员的记账");
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
        const tagResult =
            patch.tagIds === undefined
                ? null
                : cleanTagIds(patch.tagIds, state.tags);
        if (tagResult && !tagResult.ok) {
            return fail(tagResult.error);
        }
        const nextTagIds = tagResult?.tagIds;
        const changedAt = Date.now();
        const changedFields = (
            ["title", "dueDate", "note", "categoryId", "memberId", "tagIds"] as const
        ).filter((key) => patch[key] !== undefined);
        const billFieldTimes = Object.fromEntries(
            changedFields.map((key) => [key, changedAt]),
        );
        const entryFieldTimes = Object.fromEntries(
            changedFields
                .filter((key) =>
                    ["categoryId", "memberId", "tagIds"].includes(key),
                )
                .map((key) => [key, changedAt]),
        );

        const updateEntries =
            patch.categoryId !== undefined ||
            patch.memberId !== undefined ||
            patch.tagIds !== undefined;

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
                          tagIds:
                              patch.tagIds !== undefined
                                  ? nextTagIds
                                  : item.tagIds,
                          updatedAt: changedAt,
                          fieldUpdatedAt: {
                              ...item.fieldUpdatedAt,
                              ...billFieldTimes,
                          },
                      }
                    : item,
            ),
            entries: updateEntries
                ? state.entries.map((entry) => {
                      if (entry.billId !== billId) {
                          return entry;
                      }
                      if (entry.kind === "repayment") {
                          if (patch.categoryId === undefined) {
                              return entry;
                          }
                          return {
                              ...entry,
                              categoryId: nextCategoryId,
                              updatedAt: changedAt,
                              fieldUpdatedAt: {
                                  ...entry.fieldUpdatedAt,
                                  categoryId: changedAt,
                              },
                          };
                      }
                      if (entry.kind !== "expense") {
                          return entry;
                      }
                      return {
                          ...entry,
                          ...(patch.categoryId !== undefined
                              ? { categoryId: nextCategoryId }
                              : {}),
                          ...(patch.memberId !== undefined
                              ? { memberId: nextMemberId }
                              : {}),
                          ...(patch.tagIds !== undefined
                              ? { tagIds: nextTagIds }
                              : {}),
                          updatedAt: changedAt,
                          fieldUpdatedAt: {
                              ...entry.fieldUpdatedAt,
                              ...entryFieldTimes,
                          },
                      };
                  })
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
        set({
            accounts: state.accounts.filter((item) => item.id !== accountId),
            deletedConfig: tombstone(
                state.deletedConfig,
                accountId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    addCategory(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("分类名称不能为空");
        }
        const state = get();
        if (input.parent) {
            const parent = state.categories.find((item) => item.id === input.parent);
            if (!parent || parent.kind !== input.kind || parent.parent) {
                return fail("父分类不正确");
            }
        }
        const category: Category = {
            id: newId("cat"),
            name,
            kind: input.kind,
            emoji: input.emoji.trim() || "📦",
            color: input.color || "#a8a29e",
            parent: input.parent,
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
        const nextParent =
            patch.parent === undefined ? category.parent : patch.parent || undefined;
        if (nextParent) {
            if (nextParent === categoryId) {
                return fail("分类不能作为自己的父分类");
            }
            if (state.categories.some((item) => item.parent === categoryId)) {
                return fail("这个分类下已有子分类，不能再设为子分类");
            }
            const parent = state.categories.find((item) => item.id === nextParent);
            if (!parent || parent.kind !== category.kind || parent.parent) {
                return fail("父分类不正确");
            }
        }
        set({
            categories: state.categories.map((item) =>
                item.id === categoryId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          emoji: patch.emoji?.trim() || item.emoji,
                          parent: nextParent,
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
        if (state.categories.some((item) => item.parent === categoryId)) {
            return fail("请先删除这个分类下的子分类");
        }
        const used = state.entries.some((entry) => entry.categoryId === categoryId);
        const usedByBill = state.bills.some((bill) => bill.categoryId === categoryId);
        const usedByBudget = state.budgets.some((budget) =>
            budget.categoryIds.includes(categoryId),
        );
        if (used || usedByBill || usedByBudget) {
            return fail("该分类已有流水、账单或预算，不能删除");
        }
        set({
            categories: state.categories.filter((item) => item.id !== categoryId),
            deletedConfig: tombstone(
                state.deletedConfig,
                categoryId,
                getActiveMember()?.id,
            ),
        });
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
            pinHash: input.pinHash,
            pinSalt: input.pinSalt,
            pinIterations: input.pinIterations,
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
        const usedByBudget = state.budgets.some((budget) =>
            budget.memberIds.includes(memberId),
        );
        const ownedRecords = [
            ...state.entries,
            ...state.bills,
            ...state.recurringRules,
            ...state.attachments,
        ].some((item) => item.ownerId === memberId);
        if (usedByEntry || usedByBill || usedByBudget || ownedRecords) {
            return fail("该成员已有记账、流水、账单或预算，不能删除");
        }
        set({
            members: state.members.filter((item) => item.id !== memberId),
            deletedConfig: tombstone(
                state.deletedConfig,
                memberId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    addTagGroup(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("标签组名称不能为空");
        }
        const state = get();
        const group: TagGroup = {
            id: newId("tag_group"),
            name,
            selection: input.selection,
            createdAt: Date.now(),
        };
        set({ tagGroups: [...state.tagGroups, group] });
        return { ok: true, id: group.id };
    },

    updateTagGroup(groupId, patch) {
        const state = get();
        const group = state.tagGroups.find((item) => item.id === groupId);
        if (!group) {
            return fail("标签组不存在");
        }
        if (patch.name !== undefined && patch.name.trim() === "") {
            return fail("标签组名称不能为空");
        }
        set({
            tagGroups: state.tagGroups.map((item) =>
                item.id === groupId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          selection: patch.selection ?? item.selection,
                      }
                    : item,
            ),
        });
        return { ok: true };
    },

    deleteTagGroup(groupId) {
        const state = get();
        const group = state.tagGroups.find((item) => item.id === groupId);
        if (!group) {
            return fail("标签组不存在");
        }
        if (state.tags.some((tag) => tag.groupId === groupId)) {
            return fail("请先删除这个标签组下的标签");
        }
        set({
            tagGroups: state.tagGroups.filter((item) => item.id !== groupId),
            deletedConfig: tombstone(
                state.deletedConfig,
                groupId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    addTag(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("标签名称不能为空");
        }
        const state = get();
        if (input.groupId && !state.tagGroups.some((group) => group.id === input.groupId)) {
            return fail("标签组不存在");
        }
        const tag: Tag = {
            id: newId("tag"),
            name,
            color: input.color || "#0f766e",
            groupId: input.groupId,
            createdAt: Date.now(),
        };
        set({ tags: [...state.tags, tag] });
        return { ok: true, id: tag.id };
    },

    updateTag(tagId, patch) {
        const state = get();
        const tag = state.tags.find((item) => item.id === tagId);
        if (!tag) {
            return fail("标签不存在");
        }
        if (patch.name !== undefined && patch.name.trim() === "") {
            return fail("标签名称不能为空");
        }
        if (
            patch.groupId !== undefined &&
            patch.groupId !== "" &&
            !state.tagGroups.some((group) => group.id === patch.groupId)
        ) {
            return fail("标签组不存在");
        }
        set({
            tags: state.tags.map((item) =>
                item.id === tagId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          color: patch.color || item.color,
                          groupId:
                              patch.groupId === undefined
                                  ? item.groupId
                                  : patch.groupId || undefined,
                      }
                    : item,
            ),
        });
        return { ok: true };
    },

    deleteTag(tagId) {
        const state = get();
        const tag = state.tags.find((item) => item.id === tagId);
        if (!tag) {
            return fail("标签不存在");
        }
        const usedByEntry = state.entries.some((entry) =>
            entry.tagIds?.includes(tagId),
        );
        const usedByBill = state.bills.some((bill) => bill.tagIds?.includes(tagId));
        const usedByBudget = state.budgets.some((budget) =>
            budget.tagIds.includes(tagId),
        );
        if (usedByEntry || usedByBill || usedByBudget) {
            return fail("该标签已有流水、账单或预算，不能删除");
        }
        set({
            tags: state.tags.filter((item) => item.id !== tagId),
            deletedConfig: tombstone(
                state.deletedConfig,
                tagId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    addDefaultTags() {
        const state = get();
        const existingGroupIds = new Set(state.tagGroups.map((item) => item.id));
        const existingTagIds = new Set(state.tags.map((item) => item.id));
        const groups = createDefaultTagGroups().filter(
            (item) => !existingGroupIds.has(item.id),
        );
        const tags = createDefaultTags().filter(
            (item) => !existingTagIds.has(item.id),
        );
        if (groups.length === 0 && tags.length === 0) {
            return { ok: true, count: 0 };
        }
        const addedIds = new Set(
            [...groups, ...tags].map((item) => item.id),
        );
        set({
            tagGroups: [...state.tagGroups, ...groups],
            tags: [...state.tags, ...tags],
            deletedConfig: state.deletedConfig.filter(
                (item) => !addedIds.has(item.id),
            ),
            settings: { ...state.settings, defaultTagsSeeded: true },
        });
        return { ok: true, count: groups.length + tags.length };
    },

    addBudget(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("预算名称不能为空");
        }
        if (!isPositiveInteger(input.amount)) {
            return fail("预算金额必须大于 0");
        }
        const state = get();
        const categoryIds = [...new Set(input.categoryIds ?? [])];
        const tagIds = [...new Set(input.tagIds ?? [])];
        const memberIds = [...new Set(input.memberIds ?? [])];
        if (categoryIds.some((id) => !state.categories.some((item) => item.id === id))) {
            return fail("预算关联的分类不存在");
        }
        if (tagIds.some((id) => !state.tags.some((item) => item.id === id))) {
            return fail("预算关联的标签不存在");
        }
        if (memberIds.some((id) => !state.members.some((item) => item.id === id))) {
            return fail("预算关联的成员不存在");
        }
        const budget: Budget = {
            id: newId("budget"),
            name,
            period: input.period,
            amount: input.amount,
            categoryIds,
            tagIds,
            memberIds,
            createdAt: Date.now(),
        };
        set({ budgets: [...state.budgets, budget] });
        return { ok: true, id: budget.id };
    },

    updateBudget(budgetId, patch) {
        const state = get();
        const budget = state.budgets.find((item) => item.id === budgetId);
        if (!budget) {
            return fail("预算不存在");
        }
        if (patch.name !== undefined && patch.name.trim() === "") {
            return fail("预算名称不能为空");
        }
        if (patch.amount !== undefined && !isPositiveInteger(patch.amount)) {
            return fail("预算金额必须大于 0");
        }
        const categoryIds =
            patch.categoryIds === undefined
                ? budget.categoryIds
                : [...new Set(patch.categoryIds)];
        const tagIds =
            patch.tagIds === undefined ? budget.tagIds : [...new Set(patch.tagIds)];
        const memberIds =
            patch.memberIds === undefined
                ? budget.memberIds
                : [...new Set(patch.memberIds)];
        if (categoryIds.some((id) => !state.categories.some((item) => item.id === id))) {
            return fail("预算关联的分类不存在");
        }
        if (tagIds.some((id) => !state.tags.some((item) => item.id === id))) {
            return fail("预算关联的标签不存在");
        }
        if (memberIds.some((id) => !state.members.some((item) => item.id === id))) {
            return fail("预算关联的成员不存在");
        }
        set({
            budgets: state.budgets.map((item) =>
                item.id === budgetId
                    ? {
                          ...item,
                          ...patch,
                          name: patch.name?.trim() ?? item.name,
                          categoryIds,
                          tagIds,
                          memberIds,
                      }
                    : item,
            ),
        });
        return { ok: true };
    },

    deleteBudget(budgetId) {
        const state = get();
        if (!state.budgets.some((item) => item.id === budgetId)) {
            return fail("预算不存在");
        }
        set({
            budgets: state.budgets.filter((item) => item.id !== budgetId),
            deletedConfig: tombstone(
                state.deletedConfig,
                budgetId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    addRecurringRule(input) {
        const name = input.name.trim();
        if (!name) {
            return fail("周期记账名称不能为空");
        }
        if (!isPositiveInteger(input.amount)) {
            return fail("金额必须大于 0");
        }
        if (!isPositiveInteger(input.interval)) {
            return fail("间隔必须是大于 0 的整数");
        }
        if (!isValidDate(input.startDate)) {
            return fail("请选择开始日期");
        }
        if (input.endDate !== undefined && !isValidDate(input.endDate)) {
            return fail("请选择有效的结束日期");
        }
        if (input.endDate !== undefined && input.endDate < input.startDate) {
            return fail("结束日期不能早于开始日期");
        }

        const state = get();
        const category = state.categories.find((item) => item.id === input.categoryId);
        if (!category || category.kind !== input.kind) {
            return fail(input.kind === "expense" ? "请选择支出分类" : "请选择收入分类");
        }
        if (input.kind === "expense" && input.liabilityAccountId) {
            const liability = state.accounts.find(
                (item) => item.id === input.liabilityAccountId,
            );
            if (!liability || liability.kind !== "liability") {
                return fail("请选择负债账户");
            }
        } else {
            const account = input.accountId
                ? state.accounts.find((item) => item.id === input.accountId)
                : undefined;
            if (!account || account.kind !== "asset") {
                return fail(input.kind === "income" ? "请选择收款账户" : "请选择储蓄账户");
            }
        }
        if (
            input.memberId &&
            !state.members.some((member) => member.id === input.memberId)
        ) {
            return fail("请选择成员");
        }
        const tagResult = cleanTagIds(input.tagIds, state.tags);
        if (!tagResult.ok) {
            return fail(tagResult.error);
        }
        const actor = getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }

        const rule: RecurringRule = {
            id: newId("recurring"),
            name,
            kind: input.kind,
            amount: input.amount,
            frequency: input.frequency,
            interval: input.interval,
            startDate: input.startDate,
            nextDueDate: input.startDate,
            endDate: input.endDate,
            enabled: true,
            categoryId: category.id,
            accountId: input.kind === "expense" && input.liabilityAccountId
                ? undefined
                : input.accountId,
            liabilityAccountId:
                input.kind === "expense" ? input.liabilityAccountId : undefined,
            memberId: input.memberId,
            tagIds: tagResult.tagIds,
            note: cleanNote(input.note),
            ...actorFields(actor, Date.now()),
            createdAt: Date.now(),
        };
        set({ recurringRules: [...state.recurringRules, rule] });
        return { ok: true, id: rule.id };
    },

    updateRecurringRule(ruleId, patch) {
        const state = get();
        const rule = state.recurringRules.find((item) => item.id === ruleId);
        if (!rule) {
            return fail("周期记账不存在");
        }
        if (!canModify(rule)) {
            return fail("不能修改其他成员的周期记账");
        }
        const next: RecurringRule = {
            ...rule,
            ...patch,
            name: patch.name?.trim() ?? rule.name,
            accountId: patch.accountId === undefined ? rule.accountId : patch.accountId || undefined,
            liabilityAccountId:
                patch.liabilityAccountId === undefined
                    ? rule.liabilityAccountId
                    : patch.liabilityAccountId || undefined,
            memberId:
                patch.memberId === undefined ? rule.memberId : patch.memberId || undefined,
            tagIds: patch.tagIds === undefined ? rule.tagIds : [...new Set(patch.tagIds)],
            note: patch.note === undefined ? rule.note : cleanNote(patch.note),
            updatedAt: Date.now(),
            nextDueDate:
                patch.nextDueDate ??
                (patch.startDate !== undefined && patch.startDate !== rule.startDate
                    ? patch.startDate
                    : rule.nextDueDate),
        };
        if (!next.name) {
            return fail("周期记账名称不能为空");
        }
        if (!isPositiveInteger(next.amount)) {
            return fail("金额必须大于 0");
        }
        if (!isPositiveInteger(next.interval)) {
            return fail("间隔必须是大于 0 的整数");
        }
        if (!isValidDate(next.startDate)) {
            return fail("请选择开始日期");
        }
        if (next.endDate !== undefined && !isValidDate(next.endDate)) {
            return fail("请选择有效的结束日期");
        }
        if (next.endDate !== undefined && next.endDate < next.startDate) {
            return fail("结束日期不能早于开始日期");
        }
        const category = state.categories.find((item) => item.id === next.categoryId);
        if (!category || category.kind !== next.kind) {
            return fail(next.kind === "expense" ? "请选择支出分类" : "请选择收入分类");
        }
        if (next.kind === "expense" && next.liabilityAccountId) {
            const liability = state.accounts.find(
                (item) => item.id === next.liabilityAccountId,
            );
            if (!liability || liability.kind !== "liability") {
                return fail("请选择负债账户");
            }
        } else {
            const account = next.accountId
                ? state.accounts.find((item) => item.id === next.accountId)
                : undefined;
            if (!account || account.kind !== "asset") {
                return fail(next.kind === "income" ? "请选择收款账户" : "请选择储蓄账户");
            }
        }
        if (next.memberId && !state.members.some((member) => member.id === next.memberId)) {
            return fail("请选择成员");
        }
        const tagResult = cleanTagIds(next.tagIds, state.tags);
        if (!tagResult.ok) {
            return fail(tagResult.error);
        }
        next.tagIds = tagResult.tagIds;

        set({
            recurringRules: state.recurringRules.map((item) =>
                item.id === ruleId ? next : item,
            ),
        });
        return { ok: true };
    },

    deleteRecurringRule(ruleId) {
        const state = get();
        if (!state.recurringRules.some((item) => item.id === ruleId)) {
            return fail("周期记账不存在");
        }
        const rule = state.recurringRules.find((item) => item.id === ruleId);
        if (rule && !canModify(rule)) {
            return fail("不能删除其他成员的周期记账");
        }
        set({
            recurringRules: state.recurringRules.filter((item) => item.id !== ruleId),
            entries: state.entries.map((entry) =>
                entry.recurringId === ruleId
                    ? { ...entry, recurringId: undefined }
                    : entry,
            ),
            deletedConfig: tombstone(
                state.deletedConfig,
                ruleId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    postDueRecurring(now = Date.now()) {
        const state = get();
        const currentActor = getActiveMember();
        let posted = 0;
        let changedAny = false;
        const errors: string[] = [];
        const nextRules = state.recurringRules.map((rule) => {
            if (!rule.enabled) {
                return rule;
            }
            if (!rule.ownerId && !currentActor) {
                return rule;
            }
            const ruleActor = {
                id: rule.ownerId ?? currentActor?.id ?? "",
                name: rule.ownerName ?? currentActor?.name ?? "",
            };
            let next = rule.nextDueDate;
            let enabled = true;
            let lastPostedAt = rule.lastPostedAt;
            let guard = 0;
            let postedForRule = 0;
            while (next <= now && guard < 500) {
                if (rule.endDate !== undefined && next > rule.endDate) {
                    enabled = false;
                    break;
                }
                const exists = get().entries.some(
                    (entry) => entry.recurringId === rule.id && entry.date === next,
                );
                if (!exists) {
                    const memberId =
                        rule.memberId ??
                        (rule.ownerId &&
                        get().members.some((member) => member.id === rule.ownerId)
                            ? rule.ownerId
                            : undefined) ??
                        getActiveMember()?.id ??
                        get().members[0]?.id;
                    const result =
                        rule.kind === "income"
                            ? get().addIncome({
                                  amount: rule.amount,
                                  date: next,
                                  categoryId: rule.categoryId,
                                  accountId: rule.accountId ?? "",
                                  memberId,
                                  tagIds: rule.tagIds,
                                  note: rule.note,
                                  recurringId: rule.id,
                                  actor: ruleActor,
                              })
                            : get().addExpense({
                                  amount: rule.amount,
                                  date: next,
                                  categoryId: rule.categoryId,
                                  memberId,
                                  tagIds: rule.tagIds,
                                  note: rule.note,
                                  recurringId: rule.id,
                                  actor: ruleActor,
                                  source: rule.liabilityAccountId
                                      ? {
                                            type: "liability",
                                            accountId: rule.liabilityAccountId,
                                            title: rule.name,
                                        }
                                      : {
                                            type: "asset",
                                            accountId: rule.accountId ?? "",
                                        },
                              });
                    if (!result.ok) {
                        errors.push(`${rule.name}：${result.error}`);
                        break;
                    }
                    posted += 1;
                    postedForRule += 1;
                }
                lastPostedAt = next;
                next = advanceRecurringDate(next, rule);
                guard += 1;
            }
            if (rule.endDate !== undefined && next > rule.endDate) {
                enabled = false;
            }
            const ownerChanged =
                rule.ownerId !== ruleActor.id ||
                rule.ownerName !== ruleActor.name;
            if (
                postedForRule === 0 &&
                next === rule.nextDueDate &&
                enabled === rule.enabled &&
                lastPostedAt === rule.lastPostedAt &&
                !ownerChanged
            ) {
                return rule;
            }
            changedAny = true;
            return {
                ...rule,
                nextDueDate: next,
                lastPostedAt,
                enabled,
                ownerId: ruleActor.id,
                ownerName: ruleActor.name,
                updatedAt: Date.now(),
            };
        });

        if (changedAny) {
            set({ recurringRules: nextRules });
        }
        if (errors.length > 0 && posted === 0) {
            return fail(errors[0]);
        }
        return { ok: true, posted };
    },

    addAttachments(target, items) {
        if (items.length === 0) {
            return { ok: true };
        }
        const state = get();
        let targetRecord: Entry | Bill | undefined;
        if (target.kind === "entry") {
            targetRecord = state.entries.find((entry) => entry.id === target.id);
            if (!targetRecord) {
                return fail("流水不存在");
            }
        } else {
            targetRecord = state.bills.find((bill) => bill.id === target.id);
            if (!targetRecord) {
                return fail("账单不存在");
            }
        }
        if (!canModify(targetRecord)) {
            return fail("不能修改其他成员的记账");
        }
        const existing = new Set(state.attachments.map((item) => item.id));
        const actor = getActiveMember();
        if (!actor) {
            return fail("请先选择当前记账成员");
        }
        const additions = items
            .filter((item) => !existing.has(item.id))
            .map((item) => ({
                ...item,
                ownerId: item.ownerId ?? actor.id,
                ownerName: item.ownerName ?? actor.name,
            }));
        if (additions.length === 0) {
            return { ok: true };
        }
        const ids = additions.map((item) => item.id);
        const changedAt = Date.now();
        set({
            attachments: [...state.attachments, ...additions],
            entries:
                target.kind === "entry"
                    ? state.entries.map((entry) =>
                          entry.id === target.id
                              ? {
                                    ...entry,
                                    attachmentIds: [
                                        ...new Set([
                                            ...(entry.attachmentIds ?? []),
                                            ...ids,
                                        ]),
                                    ],
                                    updatedAt: changedAt,
                                    fieldUpdatedAt: {
                                        ...entry.fieldUpdatedAt,
                                        attachmentIds: changedAt,
                                    },
                                }
                              : entry,
                      )
                    : state.entries,
            bills:
                target.kind === "bill"
                    ? state.bills.map((bill) =>
                          bill.id === target.id
                              ? {
                                    ...bill,
                                    attachmentIds: [
                                        ...new Set([
                                            ...(bill.attachmentIds ?? []),
                                            ...ids,
                                        ]),
                                    ],
                                    updatedAt: changedAt,
                                    fieldUpdatedAt: {
                                        ...bill.fieldUpdatedAt,
                                        attachmentIds: changedAt,
                                    },
                                }
                              : bill,
                      )
                    : state.bills,
        });
        return { ok: true };
    },

    deleteAttachment(attachmentId) {
        const state = get();
        const attachment = state.attachments.find((item) => item.id === attachmentId);
        if (!attachment) {
            return fail("附件不存在");
        }
        if (attachment.ownerId && attachment.ownerId !== getActiveMember()?.id) {
            return fail("不能删除其他成员添加的附件");
        }
        const changedAt = Date.now();
        set({
            attachments: state.attachments.filter((item) => item.id !== attachmentId),
            entries: state.entries.map((entry) =>
                entry.attachmentIds?.includes(attachmentId)
                    ? {
                          ...entry,
                          attachmentIds: entry.attachmentIds.filter(
                              (id) => id !== attachmentId,
                          ),
                          updatedAt: changedAt,
                          fieldUpdatedAt: {
                              ...entry.fieldUpdatedAt,
                              attachmentIds: changedAt,
                          },
                      }
                    : entry,
            ),
            bills: state.bills.map((bill) =>
                bill.attachmentIds?.includes(attachmentId)
                    ? {
                          ...bill,
                          attachmentIds: bill.attachmentIds.filter(
                              (id) => id !== attachmentId,
                          ),
                          updatedAt: changedAt,
                          fieldUpdatedAt: {
                              ...bill.fieldUpdatedAt,
                              attachmentIds: changedAt,
                          },
                      }
                    : bill,
            ),
            deletedConfig: tombstone(
                state.deletedConfig,
                attachmentId,
                getActiveMember()?.id,
            ),
        });
        return { ok: true };
    },

    setSettings(patch) {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
    },

    importData(data) {
        if (!data.accounts.length) {
            return fail("导入文件里没有账户");
        }
        const seeded = seedDefaultTags(data);
        set({
            accounts: seeded.accounts,
            categories: seeded.categories,
            members: seeded.members,
            tagGroups: seeded.tagGroups,
            tags: seeded.tags,
            budgets: seeded.budgets,
            recurringRules: seeded.recurringRules,
            attachments: seeded.attachments,
            deletedEntries: seeded.deletedEntries,
            deletedBills: seeded.deletedBills,
            deletedConfig: seeded.deletedConfig,
            bills: seeded.bills,
            entries: seeded.entries,
            settings: seeded.settings,
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
        tagGroups: state.tagGroups,
        tags: state.tags,
        budgets: state.budgets,
        recurringRules: state.recurringRules,
        attachments: state.attachments,
        deletedEntries: state.deletedEntries,
        deletedBills: state.deletedBills,
        deletedConfig: state.deletedConfig,
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
