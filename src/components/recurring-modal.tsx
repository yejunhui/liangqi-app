/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RecurringFrequency, RecurringRule } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { TagSelector } from "@/components/tag-selector";
import { parseAmountToCents } from "@/domain/money";
import { fromDateInputValue, toDateInputValue } from "@/utils/date";
import { useLedgerStore } from "@/store/ledger";
import { getActiveMember } from "@/store/member-session";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

interface RecurringModalProps {
    open: boolean;
    rule: RecurringRule | null;
    onClose: () => void;
}

const FREQUENCIES: Array<{ value: RecurringFrequency; label: string }> = [
    { value: "daily", label: t("天") },
    { value: "weekly", label: t("周") },
    { value: "monthly", label: t("月") },
    { value: "yearly", label: t("年") },
];

export function RecurringModal({ open, rule, onClose }: RecurringModalProps) {
    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tagGroups = useLedgerStore((state) => state.tagGroups);
    const tags = useLedgerStore((state) => state.tags);
    const addRecurringRule = useLedgerStore((state) => state.addRecurringRule);
    const updateRecurringRule = useLedgerStore((state) => state.updateRecurringRule);

    const [name, setName] = useState("");
    const [kind, setKind] = useState<"expense" | "income">("expense");
    const [amount, setAmount] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [paymentMode, setPaymentMode] = useState<"asset" | "liability">("asset");
    const [accountId, setAccountId] = useState("");
    const [liabilityAccountId, setLiabilityAccountId] = useState("");
    const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
    const [interval, setIntervalValue] = useState("1");
    const [startDate, setStartDate] = useState(() => toDateInputValue(Date.now()));
    const [endDate, setEndDate] = useState("");
    const [memberId, setMemberId] = useState("");
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    const assetAccounts = useMemo(
        () => accounts.filter((account) => account.kind === "asset"),
        [accounts],
    );
    const liabilityAccounts = useMemo(
        () => accounts.filter((account) => account.kind === "liability"),
        [accounts],
    );
    const visibleCategories = useMemo(
        () => categories.filter((category) => category.kind === kind),
        [categories, kind],
    );

    useEffect(() => {
        if (!open) {
            return;
        }
        setKind(rule?.kind ?? "expense");
        setName(rule?.name ?? "");
        setAmount(rule ? (rule.amount / 100).toFixed(2) : "");
        setCategoryId(rule?.categoryId ?? "");
        setPaymentMode(rule?.liabilityAccountId ? "liability" : "asset");
        setAccountId(rule?.accountId ?? assetAccounts[0]?.id ?? "");
        setLiabilityAccountId(rule?.liabilityAccountId ?? liabilityAccounts[0]?.id ?? "");
        setFrequency(rule?.frequency ?? "monthly");
        setIntervalValue(String(rule?.interval ?? 1));
        setStartDate(toDateInputValue(rule?.startDate ?? Date.now()));
        setEndDate(rule?.endDate ? toDateInputValue(rule.endDate) : "");
        setMemberId(
            rule?.memberId ??
                getActiveMember()?.id ??
                members[0]?.id ??
                "",
        );
        setTagIds(rule?.tagIds ?? []);
        setNote(rule?.note ?? "");
        setError("");
    }, [open, rule, assetAccounts, liabilityAccounts, members]);

    useEffect(() => {
        if (!open) {
            return;
        }
        if (!visibleCategories.some((category) => category.id === categoryId)) {
            setCategoryId(visibleCategories[0]?.id ?? "");
        }
    }, [open, kind, visibleCategories, categoryId]);

    const editing = rule !== null;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!name.trim()) {
            setError(t("名称不能为空"));
            return;
        }
        const cents = parseAmountToCents(amount);
        if (cents === null || cents <= 0) {
            setError(t("请输入大于 0 的金额"));
            return;
        }
        const intervalValue = Number.parseInt(interval, 10);
        if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
            setError(t("间隔必须是大于 0 的整数"));
            return;
        }
        const start = fromDateInputValue(startDate);
        if (start === null) {
            setError(t("请选择开始日期"));
            return;
        }
        let end: number | undefined;
        if (endDate) {
            const parsed = fromDateInputValue(endDate);
            if (parsed === null) {
                setError(t("请选择有效的结束日期"));
                return;
            }
            end = parsed;
        }
        if (!categoryId) {
            setError(t("请选择分类"));
            return;
        }
        const input = {
            name,
            kind,
            amount: cents,
            frequency,
            interval: intervalValue,
            startDate: start,
            endDate: end,
            categoryId,
            accountId: kind === "expense" && paymentMode === "liability" ? undefined : accountId,
            liabilityAccountId: kind === "expense" && paymentMode === "liability"
                ? liabilityAccountId
                : undefined,
            memberId,
            tagIds,
            note,
        };
        const result = editing
            ? updateRecurringRule(rule.id, input)
            : addRecurringRule(input);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(editing ? t("周期记账已更新") : t("周期记账已创建"), "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? t("编辑周期记账") : t("添加周期记账")}
            description={t("到点自动生成流水；记账日期按开始日期和频率推进。")}
            size="md"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="recurring-form" className="flex-1">
                        {editing ? t("保存") : t("创建")}
                    </Button>
                </div>
            }
        >
            <form id="recurring-form" className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                    {(
                        [
                            { value: "expense", label: t("支出") },
                            { value: "income", label: t("收入") },
                        ] as const
                    ).map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setKind(option.value)}
                            className={cn(
                                "rounded-lg px-2 py-2 text-xs font-semibold transition",
                                kind === option.value
                                    ? "bg-surface text-text shadow-sm"
                                    : "text-muted hover:text-text",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("名称")}</span>
                        <input
                            className="field"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t("例如：房租")}
                            autoFocus
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("金额")}</span>
                        <input
                            className="field"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            placeholder="0.00"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("分类")}</span>
                    <select
                        className="field"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                    >
                        <option value="">{t("请选择分类")}</option>
                        {visibleCategories.map((category) => {
                            const parent = category.parent
                                ? categories.find((item) => item.id === category.parent)
                                : undefined;
                            return (
                                <option key={category.id} value={category.id}>
                                    {category.emoji} {parent ? `${parent.name} / ` : ""}
                                    {category.name}
                                </option>
                            );
                        })}
                    </select>
                </label>

                {kind === "expense" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-muted">{t("付款方式")}</span>
                            <select
                                className="field"
                                value={paymentMode}
                                onChange={(event) => {
                                    setPaymentMode(event.target.value as "asset" | "liability");
                                    setAccountId(assetAccounts[0]?.id ?? "");
                                    setLiabilityAccountId(liabilityAccounts[0]?.id ?? "");
                                }}
                            >
                                <option value="asset">{t("从存款支出")}</option>
                                <option value="liability">{t("记负债（生成账单）")}</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-muted">
                                {paymentMode === "asset" ? t("储蓄账户") : t("负债账户")}
                            </span>
                            <select
                                className="field"
                                value={paymentMode === "asset" ? accountId : liabilityAccountId}
                                onChange={(event) =>
                                    paymentMode === "asset"
                                        ? setAccountId(event.target.value)
                                        : setLiabilityAccountId(event.target.value)
                                }
                            >
                                {(paymentMode === "asset" ? assetAccounts : liabilityAccounts).map(
                                    (account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.emoji} {account.name}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>
                    </div>
                )}

                {kind === "income" && (
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("收款账户")}</span>
                        <select
                            className="field"
                            value={accountId}
                            onChange={(event) => setAccountId(event.target.value)}
                        >
                            {assetAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.emoji} {account.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("频率")}</span>
                        <select
                            className="field"
                            value={frequency}
                            onChange={(event) =>
                                setFrequency(event.target.value as RecurringFrequency)
                            }
                        >
                            {FREQUENCIES.map((item) => (
                                <option key={item.value} value={item.value}>{t("每")}{item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("间隔")}</span>
                        <input
                            className="field"
                            value={interval}
                            onChange={(event) => setIntervalValue(event.target.value)}
                            inputMode="numeric"
                            placeholder="1"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("开始日期")}</span>
                        <input
                            type="date"
                            className="field"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                        />
                    </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("结束日期（可选）")}</span>
                        <input
                            type="date"
                            className="field"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("成员")}</span>
                        <select
                            className="field"
                            value={memberId}
                            onChange={(event) => setMemberId(event.target.value)}
                        >
                            <option value="">{t("默认成员")}</option>
                            {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("备注")}</span>
                    <input
                        className="field"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={t("可选")}
                    />
                </label>

                <TagSelector
                    tags={tags}
                    groups={tagGroups}
                    value={tagIds}
                    onChange={setTagIds}
                />

                {error && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
}
