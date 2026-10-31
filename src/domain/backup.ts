/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    Account,
    Attachment,
    Bill,
    Book,
    Budget,
    Category,
    Connection,
    Entry,
    EntryLocation,
    ExportPayload,
    LedgerData,
    LibraryData,
    LibraryExportPayload,
    Member,
    OriginalAmount,
    RecurringFrequency,
    RecurringRule,
    RemoteBinding,
    RemoteUser,
    Settings,
    Tag,
    TagGroup,
    Tombstone,
} from "@/types";
import { createDefaultMember } from "@/domain/members";

type Rec = Record<string, unknown>;

function isObject(value: unknown): value is Rec {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

function optionalString(value: unknown): boolean {
    return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
    return value === undefined || isFiniteNumber(value);
}

function requiredString(value: unknown, label: string): string {
    if (!isString(value) || value.trim() === "") {
        throw new Error(`${label}格式不正确`);
    }
    return value;
}

function requiredInteger(value: unknown, label: string, min = 0): number {
    if (!isInteger(value) || value < min) {
        throw new Error(`${label}格式不正确`);
    }
    return value;
}

function requiredTimestamp(value: unknown, label: string): number {
    if (!isFiniteNumber(value) || value <= 0) {
        throw new Error(`${label}格式不正确`);
    }
    return value;
}

function parseAccount(raw: unknown, index: number): Account {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个账户格式不正确`);
    }
    const kind = raw.kind;
    if (kind !== "asset" && kind !== "liability") {
        throw new Error(`第 ${index + 1} 个账户类型不正确`);
    }
    if (!optionalString(raw.note)) {
        throw new Error(`第 ${index + 1} 个账户备注格式不正确`);
    }
    if (raw.liquid !== undefined && typeof raw.liquid !== "boolean") {
        throw new Error(`第 ${index + 1} 个账户流动资产标记格式不正确`);
    }
    return {
        id: requiredString(raw.id, "账户 id"),
        name: requiredString(raw.name, "账户名称"),
        kind,
        emoji: requiredString(raw.emoji, "账户图标"),
        openingBalance: requiredInteger(raw.openingBalance, "账户期初余额"),
        liquid: raw.liquid as boolean | undefined,
        note: raw.note as string | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "账户创建时间"),
    };
}

function parseCategory(raw: unknown, index: number): Category {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个分类格式不正确`);
    }
    const kind = raw.kind;
    if (kind !== "expense" && kind !== "income") {
        throw new Error(`第 ${index + 1} 个分类类型不正确`);
    }
    if (!optionalString(raw.parent)) {
        throw new Error(`第 ${index + 1} 个分类父分类格式不正确`);
    }
    return {
        id: requiredString(raw.id, "分类 id"),
        name: requiredString(raw.name, "分类名称"),
        kind,
        emoji: requiredString(raw.emoji, "分类图标"),
        color: requiredString(raw.color, "分类颜色"),
        parent: raw.parent as string | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "分类创建时间"),
    };
}

function parseOptionalOriginalAmount(
    value: unknown,
    index: number,
): OriginalAmount | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (
        !isObject(value) ||
        !isString(value.currency) ||
        !Number.isInteger(value.amount) ||
        (value.amount as number) <= 0 ||
        !isFiniteNumber(value.rate) ||
        (value.rate as number) <= 0
    ) {
        throw new Error(`第 ${index + 1} 条记录的外币金额格式不正确`);
    }
    return {
        currency: value.currency,
        amount: value.amount as number,
        rate: value.rate as number,
    };
}

function parseFieldUpdatedAt(
    value: unknown,
    index: number,
): Record<string, number> | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!isObject(value)) {
        throw new Error(`第 ${index + 1} 条记录字段更新时间格式不正确`);
    }
    const result: Record<string, number> = {};
    for (const [key, timestamp] of Object.entries(value)) {
        if (!isFiniteNumber(timestamp) || timestamp <= 0) {
            throw new Error(`第 ${index + 1} 条记录字段更新时间格式不正确`);
        }
        result[key] = timestamp;
    }
    return result;
}

function parseTombstone(raw: unknown, index: number, label: string): Tombstone {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个${label}删除记录格式不正确`);
    }
    if (!optionalString(raw.ownerId)) {
        throw new Error(`第 ${index + 1} 个${label}删除记录归属格式不正确`);
    }
    return {
        id: requiredString(raw.id, `${label}删除记录 id`),
        deletedAt: requiredTimestamp(raw.deletedAt, `${label}删除时间`),
        ownerId: raw.ownerId as string | undefined,
    };
}

function parseRemoteUser(value: unknown): RemoteUser | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (
        !isObject(value) ||
        !isString(value.id) ||
        !isString(value.name) ||
        (value.color !== undefined && !isString(value.color)) ||
        (value.provider !== undefined &&
            value.provider !== "github" &&
            value.provider !== "gitee" &&
            value.provider !== "webdav")
    ) {
        throw new Error("远程用户身份格式不正确");
    }
    return {
        id: value.id,
        name: value.name,
        color: value.color as string | undefined,
        provider: value.provider as RemoteUser["provider"],
    };
}

function parseAttachment(raw: unknown, index: number): Attachment {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个附件格式不正确`);
    }
    if (
        !optionalString(raw.ownerId) ||
        !optionalString(raw.ownerName) ||
        !optionalNumber(raw.remoteUploadedAt)
    ) {
        throw new Error(`第 ${index + 1} 个附件字段格式不正确`);
    }
    return {
        id: requiredString(raw.id, "附件 id"),
        name: requiredString(raw.name, "附件名称"),
        mimeType: requiredString(raw.mimeType, "附件类型"),
        size: requiredInteger(raw.size, "附件大小", 0),
        createdAt: requiredTimestamp(raw.createdAt, "附件创建时间"),
        ownerId: raw.ownerId as string | undefined,
        ownerName: raw.ownerName as string | undefined,
        remoteUploadedAt: raw.remoteUploadedAt as number | undefined,
    };
}

function parseTagGroup(raw: unknown, index: number): TagGroup {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个标签组格式不正确`);
    }
    const selection = raw.selection;
    if (selection !== "single" && selection !== "multiple") {
        throw new Error(`第 ${index + 1} 个标签组选择方式不正确`);
    }
    return {
        id: requiredString(raw.id, "标签组 id"),
        name: requiredString(raw.name, "标签组名称"),
        selection,
        createdAt: requiredTimestamp(raw.createdAt, "标签组创建时间"),
    };
}

function parseTag(raw: unknown, index: number): Tag {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个标签格式不正确`);
    }
    if (!optionalString(raw.groupId)) {
        throw new Error(`第 ${index + 1} 个标签所属组格式不正确`);
    }
    return {
        id: requiredString(raw.id, "标签 id"),
        name: requiredString(raw.name, "标签名称"),
        color: requiredString(raw.color, "标签颜色"),
        groupId: raw.groupId as string | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "标签创建时间"),
    };
}

function parseBudget(raw: unknown, index: number): Budget {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个预算格式不正确`);
    }
    const period = raw.period;
    if (period !== "month" && period !== "year") {
        throw new Error(`第 ${index + 1} 个预算周期不正确`);
    }
    const parseIds = (value: unknown, label: string): string[] => {
        if (value === undefined) {
            return [];
        }
        if (!Array.isArray(value) || value.some((item) => !isString(item))) {
            throw new Error(`第 ${index + 1} 个预算${label}格式不正确`);
        }
        return [...value];
    };
    return {
        id: requiredString(raw.id, "预算 id"),
        name: requiredString(raw.name, "预算名称"),
        period,
        amount: requiredInteger(raw.amount, "预算金额", 1),
        categoryIds: parseIds(raw.categoryIds, "分类"),
        tagIds: parseIds(raw.tagIds, "标签"),
        memberIds: parseIds(raw.memberIds, "成员"),
        createdAt: requiredTimestamp(raw.createdAt, "预算创建时间"),
    };
}

function parseRecurringRule(raw: unknown, index: number): RecurringRule {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个周期记账格式不正确`);
    }
    const kind = raw.kind;
    if (kind !== "expense" && kind !== "income") {
        throw new Error(`第 ${index + 1} 个周期记账类型不正确`);
    }
    const frequency = raw.frequency;
    const frequencies: RecurringFrequency[] = ["daily", "weekly", "monthly", "yearly"];
    if (!frequencies.includes(frequency as RecurringFrequency)) {
        throw new Error(`第 ${index + 1} 个周期记账频率不正确`);
    }
    if (
        !optionalString(raw.accountId) ||
        !optionalString(raw.liabilityAccountId) ||
        !optionalString(raw.memberId) ||
        !optionalString(raw.note) ||
        !optionalString(raw.ownerId) ||
        !optionalString(raw.ownerName) ||
        !optionalNumber(raw.updatedAt)
    ) {
        throw new Error(`第 ${index + 1} 个周期记账字段格式不正确`);
    }
    if (
        raw.tagIds !== undefined &&
        (!Array.isArray(raw.tagIds) || raw.tagIds.some((item) => !isString(item)))
    ) {
        throw new Error(`第 ${index + 1} 个周期记账标签格式不正确`);
    }
    if (!optionalNumber(raw.endDate) || !optionalNumber(raw.lastPostedAt)) {
        throw new Error(`第 ${index + 1} 个周期记账日期格式不正确`);
    }
    if (typeof raw.enabled !== "boolean") {
        throw new Error(`第 ${index + 1} 个周期记账启用状态不正确`);
    }
    return {
        id: requiredString(raw.id, "周期记账 id"),
        name: requiredString(raw.name, "周期记账名称"),
        kind,
        amount: requiredInteger(raw.amount, "周期记账金额", 1),
        frequency: frequency as RecurringFrequency,
        interval: requiredInteger(raw.interval, "周期记账间隔", 1),
        startDate: requiredTimestamp(raw.startDate, "周期记账开始日期"),
        nextDueDate: requiredTimestamp(raw.nextDueDate, "周期记账下次日期"),
        endDate: raw.endDate as number | undefined,
        enabled: raw.enabled,
        lastPostedAt: raw.lastPostedAt as number | undefined,
        categoryId: requiredString(raw.categoryId, "周期记账分类"),
        accountId: raw.accountId as string | undefined,
        liabilityAccountId: raw.liabilityAccountId as string | undefined,
        memberId: raw.memberId as string | undefined,
        tagIds: raw.tagIds as string[] | undefined,
        note: raw.note as string | undefined,
        ownerId: raw.ownerId as string | undefined,
        ownerName: raw.ownerName as string | undefined,
        updatedAt: raw.updatedAt as number | undefined,
        createdAt: requiredTimestamp(raw.createdAt, "周期记账创建时间"),
    };
}

function parseMember(raw: unknown, index: number): Member {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个成员格式不正确`);
    }
    if (
        !optionalString(raw.pinHash) ||
        !optionalString(raw.pinSalt) ||
        !optionalNumber(raw.pinIterations)
    ) {
        throw new Error(`第 ${index + 1} 个成员密码格式不正确`);
    }
    if (
        (raw.pinHash === undefined) !== (raw.pinSalt === undefined) ||
        (raw.pinHash === undefined) !== (raw.pinIterations === undefined)
    ) {
        throw new Error(`第 ${index + 1} 个成员密码不完整`);
    }
    if (
        raw.pinIterations !== undefined &&
        (!isFiniteNumber(raw.pinIterations) || raw.pinIterations <= 0)
    ) {
        throw new Error(`第 ${index + 1} 个成员密码迭代次数不正确`);
    }
    return {
        id: requiredString(raw.id, "成员 id"),
        name: requiredString(raw.name, "成员名称"),
        color: requiredString(raw.color, "成员颜色"),
        createdAt: requiredTimestamp(raw.createdAt, "成员创建时间"),
        pinHash: raw.pinHash as string | undefined,
        pinSalt: raw.pinSalt as string | undefined,
        pinIterations: raw.pinIterations as number | undefined,
    };
}

function parseBill(raw: unknown, index: number): Bill {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 张账单格式不正确`);
    }
    if (
        !optionalString(raw.categoryId) ||
        !optionalString(raw.memberId) ||
        !optionalString(raw.note) ||
        !optionalString(raw.ownerId) ||
        !optionalString(raw.ownerName) ||
        !optionalNumber(raw.updatedAt)
    ) {
        throw new Error(`第 ${index + 1} 张账单字段格式不正确`);
    }
    if (
        raw.tagIds !== undefined &&
        (!Array.isArray(raw.tagIds) || raw.tagIds.some((item) => !isString(item)))
    ) {
        throw new Error(`第 ${index + 1} 张账单标签格式不正确`);
    }
    if (
        raw.attachmentIds !== undefined &&
        (!Array.isArray(raw.attachmentIds) ||
            raw.attachmentIds.some((item) => !isString(item)))
    ) {
        throw new Error(`第 ${index + 1} 张账单附件格式不正确`);
    }
    if (!optionalNumber(raw.dueDate)) {
        throw new Error(`第 ${index + 1} 张账单到期日格式不正确`);
    }
    if (raw.dueDate !== undefined && (!isFiniteNumber(raw.dueDate) || raw.dueDate <= 0)) {
        throw new Error(`第 ${index + 1} 张账单到期日格式不正确`);
    }
    if (raw.opening !== undefined && typeof raw.opening !== "boolean") {
        throw new Error(`第 ${index + 1} 张账单期初标记格式不正确`);
    }
    const fieldUpdatedAt = parseFieldUpdatedAt(raw.fieldUpdatedAt, index);
    return {
        id: requiredString(raw.id, "账单 id"),
        liabilityAccountId: requiredString(raw.liabilityAccountId, "账单负债账户"),
        categoryId: raw.categoryId as string | undefined,
        memberId: raw.memberId as string | undefined,
        tagIds: raw.tagIds as string[] | undefined,
        attachmentIds: raw.attachmentIds as string[] | undefined,
        originalAmount: parseOptionalOriginalAmount(raw.originalAmount, index),
        title: requiredString(raw.title, "账单名称"),
        principal: requiredInteger(raw.principal, "账单金额", 1),
        purchasedAt: requiredTimestamp(raw.purchasedAt, "账单消费时间"),
        dueDate: raw.dueDate as number | undefined,
        note: raw.note as string | undefined,
        opening: raw.opening as boolean | undefined,
        ownerId: raw.ownerId as string | undefined,
        ownerName: raw.ownerName as string | undefined,
        updatedAt: raw.updatedAt as number | undefined,
        fieldUpdatedAt,
        createdAt: requiredTimestamp(raw.createdAt, "账单创建时间"),
    };
}

function parseEntry(raw: unknown, index: number): Entry {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 条流水格式不正确`);
    }
    const kind = raw.kind;
    if (
        kind !== "expense" &&
        kind !== "income" &&
        kind !== "repayment" &&
        kind !== "transfer"
    ) {
        throw new Error(`第 ${index + 1} 条流水类型不正确`);
    }
    for (const key of [
        "accountId",
        "liabilityAccountId",
        "billId",
        "categoryId",
        "memberId",
        "note",
        "recurringId",
        "toAccountId",
        "ownerId",
        "ownerName",
    ] as const) {
        if (!optionalString(raw[key])) {
            throw new Error(`第 ${index + 1} 条流水 ${key} 格式不正确`);
        }
    }
    if (!optionalNumber(raw.updatedAt)) {
        throw new Error(`第 ${index + 1} 条流水更新时间格式不正确`);
    }
    if (
        raw.tagIds !== undefined &&
        (!Array.isArray(raw.tagIds) || raw.tagIds.some((item) => !isString(item)))
    ) {
        throw new Error(`第 ${index + 1} 条流水标签格式不正确`);
    }
    if (
        raw.attachmentIds !== undefined &&
        (!Array.isArray(raw.attachmentIds) ||
            raw.attachmentIds.some((item) => !isString(item)))
    ) {
        throw new Error(`第 ${index + 1} 条流水附件格式不正确`);
    }
    if (raw.location !== undefined) {
        if (
            !isObject(raw.location) ||
            !isFiniteNumber(raw.location.lat) ||
            !isFiniteNumber(raw.location.lng) ||
            (raw.location.label !== undefined && !isString(raw.location.label))
        ) {
            throw new Error(`第 ${index + 1} 条流水位置格式不正确`);
        }
    }
    const fieldUpdatedAt = parseFieldUpdatedAt(raw.fieldUpdatedAt, index);
    return {
        id: requiredString(raw.id, "流水 id"),
        kind,
        amount: requiredInteger(raw.amount, "流水金额", 1),
        date: requiredTimestamp(raw.date, "流水日期"),
        accountId: raw.accountId as string | undefined,
        liabilityAccountId: raw.liabilityAccountId as string | undefined,
        toAccountId: raw.toAccountId as string | undefined,
        billId: raw.billId as string | undefined,
        categoryId: raw.categoryId as string | undefined,
        memberId: raw.memberId as string | undefined,
        tagIds: raw.tagIds as string[] | undefined,
        attachmentIds: raw.attachmentIds as string[] | undefined,
        location: raw.location as EntryLocation | undefined,
        originalAmount: parseOptionalOriginalAmount(raw.originalAmount, index),
        note: raw.note as string | undefined,
        recurringId: raw.recurringId as string | undefined,
        ownerId: raw.ownerId as string | undefined,
        ownerName: raw.ownerName as string | undefined,
        updatedAt: raw.updatedAt as number | undefined,
        fieldUpdatedAt,
        createdAt: requiredTimestamp(raw.createdAt, "流水创建时间"),
    };
}

function parseSettings(raw: unknown): Settings {
    if (!isObject(raw)) {
        throw new Error("设置格式不正确");
    }
    if (!isString(raw.currency) || !/^[A-Z]{3}$/.test(raw.currency)) {
        throw new Error("货币代码格式不正确");
    }
    const theme = raw.theme;
    if (theme !== "light" && theme !== "dark" && theme !== "system") {
        throw new Error("主题设置格式不正确");
    }
    if (
        raw.customCss !== undefined &&
        (!isString(raw.customCss) || raw.customCss.length > 20_000)
    ) {
        throw new Error("自定义 CSS 格式不正确");
    }
    if (
        raw.keyboardShortcuts !== undefined &&
        typeof raw.keyboardShortcuts !== "boolean"
    ) {
        throw new Error("键盘快捷键设置格式不正确");
    }
    if (
        raw.defaultTagsSeeded !== undefined &&
        typeof raw.defaultTagsSeeded !== "boolean"
    ) {
        throw new Error("默认标签标记格式不正确");
    }
    return {
        currency: raw.currency,
        theme,
        customCss: raw.customCss as string | undefined,
        keyboardShortcuts: raw.keyboardShortcuts as boolean | undefined,
        defaultTagsSeeded: raw.defaultTagsSeeded as boolean | undefined,
    };
}

function validateReferences(data: LedgerData): void {
    const accounts = new Map(data.accounts.map((account) => [account.id, account]));
    const categories = new Map(data.categories.map((category) => [category.id, category]));
    const members = new Map(data.members.map((member) => [member.id, member]));
    const tagGroups = new Map(data.tagGroups.map((group) => [group.id, group]));
    const tags = new Map(data.tags.map((tag) => [tag.id, tag]));
    const attachments = new Map(data.attachments.map((item) => [item.id, item]));
    const bills = new Map(data.bills.map((bill) => [bill.id, bill]));
    const entriesByBill = new Map<string, Entry[]>();
    for (const entry of data.entries) {
        if (entry.billId) {
            const list = entriesByBill.get(entry.billId) ?? [];
            list.push(entry);
            entriesByBill.set(entry.billId, list);
        }
    }

    for (const category of data.categories) {
        if (category.parent) {
            const parent = categories.get(category.parent);
            if (!parent || parent.kind !== category.kind || parent.parent) {
                throw new Error(`分类“${category.name}”的父分类不正确`);
            }
        }
    }

    for (const tag of data.tags) {
        if (tag.groupId && !tagGroups.has(tag.groupId)) {
            throw new Error(`标签“${tag.name}”的标签组不存在`);
        }
    }
    for (const budget of data.budgets) {
        for (const categoryId of budget.categoryIds) {
            if (!categories.has(categoryId)) {
                throw new Error(`预算“${budget.name}”关联的分类不存在`);
            }
        }
        for (const tagId of budget.tagIds) {
            if (!tags.has(tagId)) {
                throw new Error(`预算“${budget.name}”关联的标签不存在`);
            }
        }
        for (const memberId of budget.memberIds) {
            if (!members.has(memberId)) {
                throw new Error(`预算“${budget.name}”关联的成员不存在`);
            }
        }
    }

    for (const rule of data.recurringRules) {
        const category = categories.get(rule.categoryId);
        const expectedKind = rule.kind === "expense" ? "expense" : "income";
        if (!category || category.kind !== expectedKind) {
            throw new Error(`周期记账“${rule.name}”关联的分类不存在`);
        }
        if (rule.kind === "expense" && rule.liabilityAccountId) {
            const liability = accounts.get(rule.liabilityAccountId);
            if (!liability || liability.kind !== "liability") {
                throw new Error(`周期记账“${rule.name}”关联的负债账户不存在`);
            }
        } else {
            const account = rule.accountId ? accounts.get(rule.accountId) : undefined;
            if (!account || account.kind !== "asset") {
                throw new Error(`周期记账“${rule.name}”关联的资产账户不存在`);
            }
        }
        if (rule.memberId && !members.has(rule.memberId)) {
            throw new Error(`周期记账“${rule.name}”关联的成员不存在`);
        }
        for (const tagId of rule.tagIds ?? []) {
            if (!tags.has(tagId)) {
                throw new Error(`周期记账“${rule.name}”关联的标签不存在`);
            }
        }
        if (rule.endDate !== undefined && rule.endDate < rule.startDate) {
            throw new Error(`周期记账“${rule.name}”的结束日期早于开始日期`);
        }
    }

    for (const account of data.accounts) {
        if (account.kind !== "liability") {
            continue;
        }
        const openingBills = data.bills.filter(
            (bill) => bill.liabilityAccountId === account.id && bill.opening,
        );
        if (account.openingBalance > 0) {
            if (
                openingBills.length !== 1 ||
                openingBills[0].principal !== account.openingBalance
            ) {
                throw new Error(`负债账户“${account.name}”缺少匹配的期初账单`);
            }
        } else if (openingBills.length > 0) {
            throw new Error(`负债账户“${account.name}”的期初账单金额不正确`);
        }
    }

    for (const bill of data.bills) {
        if (bill.memberId && !members.has(bill.memberId)) {
            throw new Error(`账单“${bill.title}”关联的成员不存在`);
        }
        for (const tagId of bill.tagIds ?? []) {
            if (!tags.has(tagId)) {
                throw new Error(`账单“${bill.title}”关联的标签不存在`);
            }
        }
        for (const attachmentId of bill.attachmentIds ?? []) {
            if (!attachments.has(attachmentId)) {
                throw new Error(`账单“${bill.title}”关联的附件不存在`);
            }
        }
        const liability = accounts.get(bill.liabilityAccountId);
        if (!liability || liability.kind !== "liability") {
            throw new Error(`账单“${bill.title}”关联的负债账户不存在`);
        }
        if (bill.categoryId) {
            const category = categories.get(bill.categoryId);
            if (!category || category.kind !== "expense") {
                throw new Error(`账单“${bill.title}”关联的支出分类不存在`);
            }
        }
        const linked = entriesByBill.get(bill.id) ?? [];
        const linkedExpense = linked.find((entry) => entry.kind === "expense");
        const repayments = linked.filter((entry) => entry.kind === "repayment");
        if (bill.opening) {
            if (linkedExpense) {
                throw new Error(`期初账单“${bill.title}”不应关联新的支出流水`);
            }
        } else if (!linkedExpense || linkedExpense.amount !== bill.principal) {
            throw new Error(`账单“${bill.title}”缺少对应的赊账流水`);
        }
        if (linkedExpense && linkedExpense.categoryId !== bill.categoryId) {
            throw new Error(`账单“${bill.title}”与赊账流水的分类不一致`);
        }
        const repaid = repayments.reduce((sum, entry) => sum + entry.amount, 0);
        if (repaid > bill.principal) {
            throw new Error(`账单“${bill.title}”的还款金额超过本金`);
        }
    }

    for (const entry of data.entries) {
        if (entry.memberId && !members.has(entry.memberId)) {
            throw new Error("流水关联的成员不存在");
        }
        if (
            entry.recurringId &&
            !data.recurringRules.some((rule) => rule.id === entry.recurringId)
        ) {
            throw new Error("流水关联的周期记账不存在");
        }
        for (const tagId of entry.tagIds ?? []) {
            if (!tags.has(tagId)) {
                throw new Error("流水关联的标签不存在");
            }
        }
        for (const attachmentId of entry.attachmentIds ?? []) {
            if (!attachments.has(attachmentId)) {
                throw new Error("流水关联的附件不存在");
            }
        }
        if (entry.kind !== "transfer" && entry.toAccountId) {
            throw new Error("非转账流水不应设置转入账户");
        }
        if (entry.kind === "expense") {
            if (entry.billId) {
                const bill = bills.get(entry.billId);
                if (!bill) {
                    throw new Error("赊账流水关联的账单不存在");
                }
                if (entry.liabilityAccountId !== bill.liabilityAccountId) {
                    throw new Error("赊账流水的负债账户与账单不一致");
                }
                if (entry.accountId) {
                    throw new Error("赊账流水不应同时指定储蓄账户");
                }
                if (entry.categoryId && bill.categoryId && entry.categoryId !== bill.categoryId) {
                    throw new Error("赊账流水的分类与账单不一致");
                }
            } else {
                if (entry.liabilityAccountId) {
                    throw new Error("现金支出不应关联负债账户");
                }
                const account = entry.accountId ? accounts.get(entry.accountId) : undefined;
                if (!account || account.kind !== "asset") {
                    throw new Error("现金支出关联的储蓄账户不存在");
                }
            }
            if (entry.categoryId) {
                const category = categories.get(entry.categoryId);
                if (!category || category.kind !== "expense") {
                    throw new Error("支出流水关联的分类不存在");
                }
            }
        } else if (entry.kind === "income") {
            const account = entry.accountId ? accounts.get(entry.accountId) : undefined;
            if (!account || account.kind !== "asset") {
                throw new Error("收入流水关联的储蓄账户不存在");
            }
            if (entry.billId || entry.liabilityAccountId) {
                throw new Error("收入流水不应关联账单或负债");
            }
            if (entry.categoryId) {
                const category = categories.get(entry.categoryId);
                if (!category || category.kind !== "income") {
                    throw new Error("收入流水关联的分类不存在");
                }
            }
        } else if (entry.kind === "transfer") {
            const from = entry.accountId ? accounts.get(entry.accountId) : undefined;
            const to = entry.toAccountId ? accounts.get(entry.toAccountId) : undefined;
            if (!from || from.kind !== "asset" || !to || to.kind !== "asset") {
                throw new Error("转账流水关联的储蓄账户不存在");
            }
            if (from.id === to.id) {
                throw new Error("转账流水的转出和转入账户不能相同");
            }
            if (entry.liabilityAccountId || entry.billId || entry.categoryId) {
                throw new Error("转账流水不应关联负债、账单或分类");
            }
        } else {
            if (entry.toAccountId) {
                throw new Error("非转账流水不应设置转入账户");
            }
            const bill = entry.billId ? bills.get(entry.billId) : undefined;
            if (!bill) {
                throw new Error("还款流水关联的账单不存在");
            }
            const account = entry.accountId ? accounts.get(entry.accountId) : undefined;
            if (!account || account.kind !== "asset") {
                throw new Error("还款流水关联的储蓄账户不存在");
            }
            if (entry.liabilityAccountId !== bill.liabilityAccountId) {
                throw new Error("还款流水的负债账户与账单不一致");
            }
            if (entry.categoryId) {
                throw new Error("还款流水不应设置支出分类");
            }
        }
    }
}

export function createExportPayload(data: LedgerData): ExportPayload {
    return {
        ...data,
        app: "liangqi",
        version: 1,
        exportedAt: new Date().toISOString(),
    };
}

export function parseBackup(raw: unknown): { ok: true; data: LedgerData } | { ok: false; error: string } {
    try {
        if (!isObject(raw)) {
            throw new Error("备份文件格式不正确");
        }
        if (raw.app !== "liangqi" && raw.app !== "zhaibu") {
            throw new Error("不是两讫 v1 的备份文件");
        }
        if (raw.version !== 1) {
            throw new Error("不是两讫 v1 的备份文件");
        }
        if (
            !Array.isArray(raw.accounts) ||
            !Array.isArray(raw.categories) ||
            !Array.isArray(raw.bills) ||
            !Array.isArray(raw.entries)
        ) {
            throw new Error("备份文件缺少账本数据");
        }

        const accounts = raw.accounts.map(parseAccount);
        const categories = raw.categories.map(parseCategory);
        const members =
            Array.isArray(raw.members) && raw.members.length > 0
                ? raw.members.map(parseMember)
                : [createDefaultMember()];
        const tagGroups = Array.isArray(raw.tagGroups)
            ? raw.tagGroups.map(parseTagGroup)
            : [];
        const tags = Array.isArray(raw.tags) ? raw.tags.map(parseTag) : [];
        const budgets = Array.isArray(raw.budgets)
            ? raw.budgets.map(parseBudget)
            : [];
        const recurringRules = Array.isArray(raw.recurringRules)
            ? raw.recurringRules.map(parseRecurringRule)
            : [];
        const attachments = Array.isArray(raw.attachments)
            ? raw.attachments.map(parseAttachment)
            : [];
        const deletedEntries = Array.isArray(raw.deletedEntries)
            ? raw.deletedEntries.map((item, index) =>
                  parseTombstone(item, index, "流水"),
              )
            : [];
        const deletedBills = Array.isArray(raw.deletedBills)
            ? raw.deletedBills.map((item, index) => parseTombstone(item, index, "账单"))
            : [];
        const deletedConfig = Array.isArray(raw.deletedConfig)
            ? raw.deletedConfig.map((item, index) =>
                  parseTombstone(item, index, "共享配置"),
              )
            : [];
        const bills = raw.bills.map(parseBill);
        const entries = raw.entries.map(parseEntry);
        const settings = parseSettings(raw.settings);

        const ids = new Set<string>();
        for (const item of [
            ...accounts,
            ...categories,
            ...members,
            ...tagGroups,
            ...tags,
            ...budgets,
            ...recurringRules,
            ...attachments,
            ...bills,
            ...entries,
        ]) {
            if (ids.has(item.id)) {
                throw new Error(`存在重复 id：${item.id}`);
            }
            ids.add(item.id);
        }

        const data: LedgerData = {
            accounts,
            categories,
            members,
            tagGroups,
            tags,
            budgets,
            recurringRules,
            attachments,
            deletedEntries,
            deletedBills,
            deletedConfig,
            bills,
            entries,
            settings,
        };
        validateReferences(data);
        return { ok: true, data };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "备份文件解析失败",
        };
    }
}

function parseRemoteBinding(value: unknown): RemoteBinding | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!isObject(value)) {
        throw new Error("远程绑定格式不正确");
    }
    if (
        !isString(value.connectionId) ||
        !isString(value.remoteBookId) ||
        typeof value.autoSync !== "boolean"
    ) {
        throw new Error("远程绑定字段不完整");
    }
    if (value.revision !== undefined && !isString(value.revision)) {
        throw new Error("远程版本号格式不正确");
    }
    if (value.lastSyncedAt !== undefined && !isFiniteNumber(value.lastSyncedAt)) {
        throw new Error("远程同步时间格式不正确");
    }
    return {
        connectionId: value.connectionId,
        remoteBookId: value.remoteBookId,
        revision: value.revision as string | undefined,
        lastSyncedAt: value.lastSyncedAt as number | undefined,
        autoSync: value.autoSync,
    };
}

function parseBookRecord(raw: unknown, index: number): Book {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个账本格式不正确`);
    }
    const id = requiredString(raw.id, "账本 id");
    const name = requiredString(raw.name, "账本名称");
    const createdAt = requiredTimestamp(raw.createdAt, "账本创建时间");
    const updatedAt = requiredTimestamp(raw.updatedAt, "账本更新时间");
    const parsed = parseBackup({
        ...raw,
        app: "liangqi",
        version: 1,
    });
    if (!parsed.ok) {
        throw new Error(`账本“${name}”：${parsed.error}`);
    }
    return {
        ...parsed.data,
        id,
        name,
        createdAt,
        updatedAt,
        remote: parseRemoteBinding(raw.remote),
    };
}

function parseConnection(raw: unknown, index: number): Connection {
    if (!isObject(raw)) {
        throw new Error(`第 ${index + 1} 个远程连接格式不正确`);
    }
    const provider = raw.provider;
    if (provider !== "github" && provider !== "gitee" && provider !== "webdav") {
        throw new Error(`第 ${index + 1} 个远程连接类型不正确`);
    }
    for (const key of [
        "owner",
        "repo",
        "branch",
        "token",
        "url",
        "username",
        "password",
    ] as const) {
        if (!optionalString(raw[key])) {
            throw new Error(`第 ${index + 1} 个远程连接 ${key} 格式不正确`);
        }
    }
    if (raw.tokenKind !== undefined && raw.tokenKind !== "pat" && raw.tokenKind !== "oauth") {
        throw new Error(`第 ${index + 1} 个远程连接 token 类型不正确`);
    }
    return {
        id: requiredString(raw.id, "连接 id"),
        provider,
        label: requiredString(raw.label, "连接名称"),
        createdAt: requiredTimestamp(raw.createdAt, "连接创建时间"),
        owner: raw.owner as string | undefined,
        repo: raw.repo as string | undefined,
        branch: raw.branch as string | undefined,
        token: raw.token as string | undefined,
        tokenKind: raw.tokenKind as Connection["tokenKind"],
        url: raw.url as string | undefined,
        username: raw.username as string | undefined,
        password: raw.password as string | undefined,
        user: parseRemoteUser(raw.user),
    };
}

export function createLibraryExport(library: LibraryData): LibraryExportPayload {
    return {
        app: "liangqi",
        version: 2,
        exportedAt: new Date().toISOString(),
        secretsIncluded: false,
        library: {
            ...library,
            books: library.books.map((book) => ({
                ...book,
                remote: book.remote ? { ...book.remote } : undefined,
            })),
            connections: library.connections.map((connection) => ({
                ...connection,
                token: undefined,
                password: undefined,
            })),
        },
    };
}

export function parseLibraryBackup(
    raw: unknown,
): { ok: true; library: LibraryData } | { ok: false; error: string } {
    try {
        if (!isObject(raw)) {
            throw new Error("书库备份格式不正确");
        }
        if (raw.app !== "liangqi" || raw.version !== 2) {
            throw new Error("不是两讫 v2 书库备份");
        }
        if (!isObject(raw.library)) {
            throw new Error("书库备份缺少 library 数据");
        }
        const libraryRaw = raw.library;
        if (!Array.isArray(libraryRaw.books)) {
            throw new Error("书库备份缺少账本列表");
        }
        const books = libraryRaw.books.map(parseBookRecord);
        if (books.length === 0) {
            throw new Error("书库备份里没有账本");
        }
        const bookIds = new Set<string>();
        for (const book of books) {
            if (bookIds.has(book.id)) {
                throw new Error(`书库中存在重复账本 id：${book.id}`);
            }
            bookIds.add(book.id);
        }

        const connections = Array.isArray(libraryRaw.connections)
            ? libraryRaw.connections.map(parseConnection)
            : [];
        const connectionIds = new Set(connections.map((connection) => connection.id));
        const normalizedBooks = books.map((book) =>
            book.remote && !connectionIds.has(book.remote.connectionId)
                ? { ...book, remote: undefined }
                : book,
        );
        const activeBookId =
            isString(libraryRaw.activeBookId) && bookIds.has(libraryRaw.activeBookId)
                ? libraryRaw.activeBookId
                : normalizedBooks[0].id;

        return {
            ok: true,
            library: {
                version: 2,
                books: normalizedBooks,
                activeBookId,
                connections,
            },
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "书库备份解析失败",
        };
    }
}
