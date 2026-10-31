/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
    ArrowDownUp,
    ArrowRightLeft,
    CalendarDays,
    CreditCard,
    Info,
    MapPin,
    Paperclip,
    Plus,
    ReceiptText,
    RefreshCw,
    Wallet,
    X,
} from "lucide-react";
import type { EntryKind, EntryLocation } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { TagSelector } from "@/components/tag-selector";
import {
    MAX_ATTACHMENT_SIZE,
    createAttachmentMeta,
    deleteAttachmentFile,
    saveAttachmentFile,
} from "@/domain/attachments";
import {
    getAccountBalance,
    getBillDueInfo,
    getBillRemaining,
    getBillStatus,
    getOpenBills,
} from "@/domain/ledger";
import { formatCents, parseAmountToCents, currencySymbol } from "@/domain/money";
import { CURRENCIES } from "@/domain/currencies";
import {
    formatExchangeRate,
    getExchangeRate,
    type ExchangeRateQuote,
} from "@/domain/exchange-rates";
import { fromDateInputValue, toDateInputValue } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { getActiveMember } from "@/store/member-session";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

const KIND_OPTIONS: Array<{ value: EntryKind; label: string; icon: typeof Wallet }> = [
    { value: "expense", label: "支出", icon: ReceiptText },
    { value: "income", label: "收入", icon: ArrowDownUp },
    { value: "repayment", label: "还款", icon: CreditCard },
    { value: "transfer", label: "转账", icon: ArrowRightLeft },
];

export function EntryModal() {
    const open = useUIStore((state) => state.entryModalOpen);
    const initialKind = useUIStore((state) => state.entryModalKind);
    const initialBillId = useUIStore((state) => state.entryModalBillId);
    const initialPaymentMode = useUIStore((state) => state.entryModalPaymentMode);
    const prefill = useUIStore((state) => state.entryModalPrefill);
    const close = useUIStore((state) => state.closeEntryModal);

    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tagGroups = useLedgerStore((state) => state.tagGroups);
    const tags = useLedgerStore((state) => state.tags);
    const bills = useLedgerStore((state) => state.bills);
    const entries = useLedgerStore((state) => state.entries);
    const addExpense = useLedgerStore((state) => state.addExpense);
    const addIncome = useLedgerStore((state) => state.addIncome);
    const addRepayment = useLedgerStore((state) => state.addRepayment);
    const addTransfer = useLedgerStore((state) => state.addTransfer);
    const currency = useCurrency();

    const [kind, setKind] = useState<EntryKind>("expense");
    const [amount, setAmount] = useState("");
    const [entryCurrency, setEntryCurrency] = useState(currency);
    const [exchangeRate, setExchangeRate] = useState("1");
    const [rateStatus, setRateStatus] = useState<
        "idle" | "loading" | "live" | "cached" | "manual" | "unavailable"
    >("idle");
    const [rateFetchedAt, setRateFetchedAt] = useState<number | null>(null);
    const [autoRate, setAutoRate] = useState(true);
    const [date, setDate] = useState(() => toDateInputValue(Date.now()));
    const [categoryId, setCategoryId] = useState("");
    const [memberId, setMemberId] = useState("");
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [paymentMode, setPaymentMode] = useState<"asset" | "liability">("asset");
    const [assetAccountId, setAssetAccountId] = useState("");
    const [toAccountId, setToAccountId] = useState("");
    const [liabilityAccountId, setLiabilityAccountId] = useState("");
    const [billTitle, setBillTitle] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [billId, setBillId] = useState("");
    const [note, setNote] = useState("");
    const [location, setLocation] = useState<EntryLocation | undefined>(undefined);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const manualRateRef = useRef(false);

    const assetAccounts = useMemo(
        () => accounts.filter((account) => account.kind === "asset"),
        [accounts],
    );
    const liabilityAccounts = useMemo(
        () => accounts.filter((account) => account.kind === "liability"),
        [accounts],
    );
    const expenseCategories = useMemo(
        () => categories.filter((category) => category.kind === "expense"),
        [categories],
    );
    const incomeCategories = useMemo(
        () => categories.filter((category) => category.kind === "income"),
        [categories],
    );
    const openBills = useMemo(() => getOpenBills(bills, entries), [bills, entries]);

    const selectedBill = bills.find((bill) => bill.id === billId);
    const selectedCategory = categories.find((category) => category.id === categoryId);
    const selectedAsset = accounts.find((account) => account.id === assetAccountId);
    const foreignCents = parseAmountToCents(amount);
    const rateNumber = Number.parseFloat(exchangeRate);
    const isForeign = entryCurrency !== currency;
    const parsedAmount =
        foreignCents === null
            ? null
            : isForeign
              ? Number.isFinite(rateNumber) && rateNumber > 0
                  ? Math.round(foreignCents * rateNumber)
                  : null
              : foreignCents;
    const repaymentRemaining = selectedBill ? getBillRemaining(selectedBill, entries) : 0;
    const repaymentProjected = Math.max(0, repaymentRemaining - (parsedAmount ?? 0));
    const assetBalance = selectedAsset ? getAccountBalance(selectedAsset, entries) : 0;

    useEffect(() => {
        if (!open) {
            return;
        }
        const state = useLedgerStore.getState();
        const assetList = state.accounts.filter((account) => account.kind === "asset");
        const liabilityList = state.accounts.filter((account) => account.kind === "liability");
        const expenseList = state.categories.filter((category) => category.kind === "expense");
        const incomeList = state.categories.filter((category) => category.kind === "income");
        const initialBill =
            initialKind === "repayment" && initialBillId
                ? state.bills.find((bill) => bill.id === initialBillId)
                : undefined;

        setKind(initialKind);
        setAmount(
            initialBill
                ? (getBillRemaining(initialBill, state.entries) / 100).toFixed(2)
                : prefill?.amount
                  ? (prefill.amount / 100).toFixed(2)
                  : "",
        );
        setEntryCurrency(currency);
        setExchangeRate("1");
        setRateStatus("idle");
        setRateFetchedAt(null);
        setAutoRate(true);
        manualRateRef.current = false;
        setDate(toDateInputValue(prefill?.date ?? Date.now()));
        const initialCategories = initialKind === "income" ? incomeList : expenseList;
        setCategoryId(
            initialCategories.some((category) => category.id === prefill?.categoryId)
                ? (prefill?.categoryId ?? "")
                : (initialCategories[0]?.id ?? ""),
        );
        setMemberId(
            initialBill?.memberId ??
                prefill?.memberId ??
                getActiveMember()?.id ??
                state.members[0]?.id ??
                "",
        );
        setTagIds(initialBill?.tagIds ?? prefill?.tagIds ?? []);
        setPaymentMode(
            initialPaymentMode ??
                (prefill?.liabilityAccountId ? "liability" : "asset"),
        );
        setAssetAccountId(prefill?.assetAccountId ?? assetList[0]?.id ?? "");
        setToAccountId(
            assetList.find((account) => account.id !== (prefill?.assetAccountId ?? assetList[0]?.id))
                ?.id ?? assetList[1]?.id ?? assetList[0]?.id ?? "",
        );
        setLiabilityAccountId(
            prefill?.liabilityAccountId ?? liabilityList[0]?.id ?? "",
        );
        setBillTitle("");
        setDueDate("");
        setBillId(initialBill?.id ?? "");
        setNote(prefill?.note ?? "");
        setLocation(prefill?.location);
        setFiles([]);
        setError("");
    }, [open, initialKind, initialBillId, initialPaymentMode, prefill, currency]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const list = kind === "income" ? incomeCategories : expenseCategories;
        setCategoryId((current) =>
            list.some((category) => category.id === current) ? current : (list[0]?.id ?? ""),
        );
    }, [kind, open, incomeCategories, expenseCategories]);

    useEffect(() => {
        if (!open) {
            return;
        }
        if (entryCurrency === currency) {
            setRateStatus("idle");
            setRateFetchedAt(null);
            setAutoRate(true);
            return;
        }
        let cancelled = false;
        setRateStatus("loading");
        setExchangeRate("");
        setAutoRate(true);
        manualRateRef.current = false;
        void getExchangeRate(currency, entryCurrency).then((quote) => {
            if (cancelled || manualRateRef.current) {
                return;
            }
            if (!quote) {
                setRateStatus("unavailable");
                setAutoRate(false);
                return;
            }
            setExchangeRate(formatExchangeRate(quote.rate));
            setRateStatus(
                quote.source === "live" && !quote.stale ? "live" : "cached",
            );
            setRateFetchedAt(quote.fetchedAt);
            setAutoRate(true);
        });
        return () => {
            cancelled = true;
        };
    }, [open, entryCurrency, currency]);

    async function refreshExchangeRate(): Promise<ExchangeRateQuote | null> {
        if (entryCurrency === currency) {
            return null;
        }
        manualRateRef.current = false;
        setRateStatus("loading");
        const quote = await getExchangeRate(currency, entryCurrency, { force: true });
        if (!quote) {
            setRateStatus("unavailable");
            setAutoRate(false);
            return null;
        }
        if (manualRateRef.current) {
            return null;
        }
        setExchangeRate(formatExchangeRate(quote.rate));
        setRateStatus(quote.source === "live" && !quote.stale ? "live" : "cached");
        setRateFetchedAt(quote.fetchedAt);
        setAutoRate(true);
        return quote;
    }

    useEffect(() => {
        if (kind !== "repayment" || !billId) {
            return;
        }
        const bill = useLedgerStore.getState().bills.find((item) => item.id === billId);
        if (!bill) {
            return;
        }
        const remaining = getBillRemaining(bill, useLedgerStore.getState().entries);
        setAmount((remaining / 100).toFixed(2));
        setMemberId(bill.memberId ?? useLedgerStore.getState().members[0]?.id ?? "");
        setTagIds(bill.tagIds ?? []);
    }, [kind, billId]);

    function switchKind(next: EntryKind) {
        setKind(next);
        setError("");
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        const rawForeignCents = parseAmountToCents(amount);
        if (rawForeignCents === null || rawForeignCents <= 0) {
            setError("请输入大于 0 的金额");
            return;
        }

        let effectiveRate = isForeign ? rateNumber : 1;
        if (isForeign && autoRate) {
            const quote = await refreshExchangeRate();
            if (quote) {
                effectiveRate = quote.rate;
            }
        }
        const cents = isForeign
            ? Number.isFinite(effectiveRate) && effectiveRate > 0
                ? Math.round(rawForeignCents * effectiveRate)
                : null
            : rawForeignCents;
        if (cents === null || cents <= 0) {
            setError("请输入有效汇率");
            return;
        }
        const timestamp = fromDateInputValue(date);
        if (timestamp === null) {
            setError("请选择有效日期");
            return;
        }
        if (!memberId) {
            setError("请选择成员");
            return;
        }

        const originalAmount = isForeign
            ? {
                  currency: entryCurrency,
                  amount: rawForeignCents,
                  rate: effectiveRate,
              }
            : undefined;

        let createdEntryId: string | undefined;

        if (kind === "expense") {
            if (!categoryId) {
                setError("请选择支出分类");
                return;
            }
            if (paymentMode === "asset") {
                if (!assetAccountId) {
                    setError("请选择储蓄账户");
                    return;
                }
                const result = addExpense({
                    amount: cents,
                    date: timestamp,
                    categoryId,
                    memberId,
                    tagIds,
                    location,
                    originalAmount,
                    note,
                    source: { type: "asset", accountId: assetAccountId },
                });
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                createdEntryId = result.entryId;
                toast("支出已记入，存款已扣减", "success");
            } else {
                if (!liabilityAccountId) {
                    setError("请选择负债账户");
                    return;
                }
                let dueTimestamp: number | undefined;
                if (dueDate) {
                    const parsedDue = fromDateInputValue(dueDate);
                    if (parsedDue === null) {
                        setError("请选择有效到期日");
                        return;
                    }
                    dueTimestamp = parsedDue;
                }
                const result = addExpense({
                    amount: cents,
                    date: timestamp,
                    categoryId,
                    memberId,
                    tagIds,
                    location,
                    originalAmount,
                    note,
                    source: {
                        type: "liability",
                        accountId: liabilityAccountId,
                        title: billTitle,
                        dueDate: dueTimestamp,
                    },
                });
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                createdEntryId = result.entryId;
                toast("已生成待还账单，存款没有变动", "success");
            }
        } else if (kind === "income") {
            if (!categoryId) {
                setError("请选择收入分类");
                return;
            }
            if (!assetAccountId) {
                setError("请选择收款账户");
                return;
            }
            const result = addIncome({
                amount: cents,
                date: timestamp,
                categoryId,
                accountId: assetAccountId,
                memberId,
                tagIds,
                location,
                originalAmount,
                note,
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            createdEntryId = result.entryId;
            toast("收入已记入", "success");
        } else if (kind === "transfer") {
            if (!assetAccountId || !toAccountId) {
                setError("请选择转出和转入账户");
                return;
            }
            if (assetAccountId === toAccountId) {
                setError("转出账户和转入账户不能相同");
                return;
            }
            const result = addTransfer({
                amount: cents,
                date: timestamp,
                fromAccountId: assetAccountId,
                toAccountId,
                memberId,
                tagIds,
                location,
                originalAmount,
                note,
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            createdEntryId = result.entryId;
            toast("转账已记录，不计入支出和收入", "success");
        } else {
            if (!billId) {
                setError("请选择要还款的账单");
                return;
            }
            if (!assetAccountId) {
                setError("请选择还款账户");
                return;
            }
            const result = addRepayment({
                amount: cents,
                date: timestamp,
                billId,
                accountId: assetAccountId,
                memberId,
                tagIds,
                location,
                originalAmount,
                note,
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            createdEntryId = result.entryId;
            toast("还款已记录，不会重复计入支出", "success");
        }

        if (createdEntryId && files.length > 0) {
            const metas = files.map(createAttachmentMeta);
            try {
                for (let index = 0; index < files.length; index += 1) {
                    await saveAttachmentFile(metas[index].id, files[index]);
                }
                const attachResult = useLedgerStore
                    .getState()
                    .addAttachments({ kind: "entry", id: createdEntryId }, metas);
                if (!attachResult.ok) {
                    await Promise.all(metas.map((meta) => deleteAttachmentFile(meta.id)));
                    toast(attachResult.error, "error");
                } else {
                    toast(`已添加 ${metas.length} 个附件`, "success");
                }
            } catch {
                toast("附件保存失败，流水已正常记入", "error");
            }
        }

        close();
    }

    const submitLabel =
        kind === "expense"
            ? "记支出"
            : kind === "income"
              ? "记收入"
              : kind === "transfer"
                ? "确认转账"
                : "确认还款";

    return (
        <Modal
            open={open}
            onClose={close}
            title="记一笔"
            description="现金支出、赊账和还款分开记，统计才不会乱。"
            size="md"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={close}>
                        取消
                    </Button>
                    <Button type="submit" form="entry-form" className="flex-[1.5]">
                        {submitLabel}
                    </Button>
                </div>
            }
        >
            <form id="entry-form" className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
                    {KIND_OPTIONS.map((option) => {
                        const active = kind === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => switchKind(option.value)}
                                className={cn(
                                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition",
                                    active
                                        ? "bg-surface text-text shadow-sm"
                                        : "text-muted hover:text-text",
                                )}
                            >
                                <option.icon className="size-3.5" />
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                <div className="rounded-2xl border border-line bg-surface-2/55 px-4 py-5 text-center">
                    <p className="text-[11px] font-medium text-muted">
                        {kind === "expense"
                            ? paymentMode === "asset"
                                ? "现在从存款里扣"
                                : "先记负债，之后还款"
                            : kind === "income"
                              ? "这笔钱收到哪里"
                              : kind === "transfer"
                                ? "从哪个账户转到哪个账户"
                                : "这次还多少"}
                    </p>
                    <div className="mt-2 flex items-baseline justify-center gap-1.5">
                        <span className="text-xl font-semibold text-muted">
                            {currencySymbol(entryCurrency)}
                        </span>
                        <input
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            placeholder="0.00"
                            aria-label="金额"
                            className="w-44 bg-transparent text-center text-4xl font-bold tracking-tight text-text outline-none placeholder:text-line-strong sm:w-56"
                        />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted">
                        <select
                            value={entryCurrency}
                            onChange={(event) => {
                                setEntryCurrency(event.target.value);
                                setExchangeRate("1");
                                setAutoRate(true);
                                setRateStatus("loading");
                                manualRateRef.current = false;
                            }}
                            className="rounded-lg border border-line bg-surface px-2 py-1 text-[10px] font-medium text-text"
                            aria-label="记账币种"
                        >
                            {!CURRENCIES.some((item) => item.value === currency) && (
                                <option value={currency}>{currency}</option>
                            )}
                            {CURRENCIES.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                        {isForeign && (
                            <label className="flex items-center gap-1">
                                1 {entryCurrency} =
                                <input
                                    value={exchangeRate}
                                    onChange={(event) => {
                                        setExchangeRate(event.target.value);
                                        setRateStatus("manual");
                                        setAutoRate(false);
                                        manualRateRef.current = true;
                                    }}
                                    inputMode="decimal"
                                    className="w-20 rounded-md border border-line bg-surface px-1.5 py-1 text-center text-[10px] text-text outline-none"
                                    aria-label="汇率"
                                />
                                {currency}
                            </label>
                        )}
                        {isForeign && (
                            <button
                                type="button"
                                onClick={() => void refreshExchangeRate()}
                                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-1 text-[10px] font-medium text-muted transition hover:text-text"
                            >
                                <RefreshCw
                                    className={cn(
                                        "size-3",
                                        rateStatus === "loading" && "animate-spin",
                                    )}
                                />
                                实时
                            </button>
                        )}
                    </div>
                    {isForeign && (
                        <p
                            className={cn(
                                "mt-1.5 text-[10px]",
                                rateStatus === "live"
                                    ? "text-success"
                                    : rateStatus === "cached" ||
                                        rateStatus === "unavailable"
                                      ? "text-liability"
                                      : "text-muted",
                            )}
                        >
                            {rateStatus === "loading"
                                ? "正在获取实时汇率…"
                                : rateStatus === "live"
                                  ? `实时汇率${
                                        rateFetchedAt
                                            ? ` · ${new Date(rateFetchedAt).toLocaleTimeString(
                                                  "zh-CN",
                                                  {
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  },
                                              )} 更新`
                                            : ""
                                    }`
                                  : rateStatus === "cached"
                                    ? "使用本机缓存汇率，可点「实时」刷新或手动修改"
                                    : rateStatus === "unavailable"
                                      ? "实时汇率不可用，请手动填写汇率"
                                      : rateStatus === "manual"
                                        ? "手动汇率；保存时不会自动刷新"
                                        : ""}
                        </p>
                    )}
                    {isForeign && parsedAmount !== null && foreignCents !== null && (
                        <p className="mt-1.5 text-[10px] text-accent">
                            折合 {formatCents(parsedAmount, currency)}
                        </p>
                    )}

                    {kind === "repayment" && selectedBill && (
                        <p className="mt-2 text-[11px] text-muted">
                            待还 {formatCents(repaymentRemaining, currency)}
                            {parsedAmount !== null && parsedAmount > 0 && (
                                <>
                                    {" "}
                                    · 还款后剩 {formatCents(repaymentProjected, currency)}
                                </>
                            )}
                        </p>
                    )}
                </div>

                <MemberPicker members={members} value={memberId} onChange={setMemberId} />

                {kind === "expense" && (
                    <div className="space-y-4">
                        <div>
                            <p className="mb-2 text-xs font-semibold text-muted">这笔钱怎么付？</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMode("asset")}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition",
                                        paymentMode === "asset"
                                            ? "border-accent bg-accent-soft/70"
                                            : "border-line bg-surface hover:border-line-strong",
                                    )}
                                >
                                    <Wallet
                                        className={cn(
                                            "size-4",
                                            paymentMode === "asset" ? "text-accent" : "text-muted",
                                        )}
                                    />
                                    <span className="mt-2 block text-xs font-semibold text-text">
                                        现在扣存款
                                    </span>
                                    <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                                        从现金 / 银行卡直接扣
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMode("liability")}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition",
                                        paymentMode === "liability"
                                            ? "border-liability bg-liability-soft/70"
                                            : "border-line bg-surface hover:border-line-strong",
                                    )}
                                >
                                    <CreditCard
                                        className={cn(
                                            "size-4",
                                            paymentMode === "liability"
                                                ? "text-liability"
                                                : "text-muted",
                                        )}
                                    />
                                    <span className="mt-2 block text-xs font-semibold text-text">
                                        先记负债
                                    </span>
                                    <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                                        生成待还账单，不动存款
                                    </span>
                                </button>
                            </div>
                        </div>

                        {paymentMode === "asset" ? (
                            <>
                                <AccountPicker
                                    label="从哪个账户支出"
                                    accounts={assetAccounts}
                                    value={assetAccountId}
                                    onChange={setAssetAccountId}
                                    emptyHint="还没有储蓄账户，请先到账户页添加"
                                />
                                {selectedAsset &&
                                    parsedAmount !== null &&
                                    parsedAmount > 0 &&
                                    parsedAmount > assetBalance && (
                                        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-danger">
                                            这个账户当前余额是{" "}
                                            {formatCents(assetBalance, currency)}
                                            ，支出后余额会变成负数。
                                        </p>
                                    )}
                            </>
                        ) : (
                            <div className="space-y-4">
                                <AccountPicker
                                    label="记到哪个负债账户"
                                    accounts={liabilityAccounts}
                                    value={liabilityAccountId}
                                    onChange={setLiabilityAccountId}
                                    emptyHint="还没有负债账户，请先到账户页添加"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-muted">
                                            账单名称
                                        </span>
                                        <input
                                            className="field"
                                            value={billTitle}
                                            onChange={(event) => setBillTitle(event.target.value)}
                                            placeholder={selectedCategory?.name ?? "例如：这笔赊账"}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-muted">
                                            到期日（可选）
                                        </span>
                                        <input
                                            type="date"
                                            className="field"
                                            value={dueDate}
                                            onChange={(event) => setDueDate(event.target.value)}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        <CategoryPicker
                            label="支出分类"
                            categories={expenseCategories}
                            value={categoryId}
                            onChange={setCategoryId}
                        />
                    </div>
                )}

                {kind === "income" && (
                    <div className="space-y-4">
                        <CategoryPicker
                            label="收入分类"
                            categories={incomeCategories}
                            value={categoryId}
                            onChange={setCategoryId}
                        />
                        <AccountPicker
                            label="收到哪个账户"
                            accounts={assetAccounts}
                            value={assetAccountId}
                            onChange={setAssetAccountId}
                            emptyHint="还没有储蓄账户，请先到账户页添加"
                        />
                    </div>
                )}

                {kind === "transfer" && (
                    <div className="space-y-4">
                        <AccountPicker
                            label="从哪个账户转出"
                            accounts={assetAccounts}
                            value={assetAccountId}
                            onChange={setAssetAccountId}
                            emptyHint="还没有储蓄账户，请先到账户页添加"
                        />
                        <AccountPicker
                            label="转到哪个账户"
                            accounts={assetAccounts}
                            value={toAccountId}
                            onChange={setToAccountId}
                            emptyHint="至少需要两个储蓄账户才能转账"
                        />
                        {assetAccountId === toAccountId && (
                            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[11px] text-danger">
                                转出账户和转入账户不能相同。
                            </p>
                        )}
                        <p className="rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-[10px] leading-relaxed text-muted">
                            转账只改变两个账户的余额，不会计入支出、收入或预算。
                        </p>
                    </div>
                )}

                {kind === "repayment" && (
                    <div className="space-y-4">
                        {openBills.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-line bg-surface-2/50 px-4 py-6 text-center">
                                <p className="text-sm font-semibold text-text">当前没有待还账单</p>
                                <p className="mt-1 text-xs text-muted">
                                    赊账消费会自动生成账单，也可以先记一笔。
                                </p>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="mt-4"
                                    onClick={() => {
                                        setKind("expense");
                                        setPaymentMode("liability");
                                    }}
                                >
                                    <Plus className="size-3.5" />
                                    去记一笔赊账
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <p className="mb-2 text-xs font-semibold text-muted">选择账单</p>
                                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                        {openBills.map((bill) => {
                                            const remaining = getBillRemaining(bill, entries);
                                            const billCategory = categories.find(
                                                (category) => category.id === bill.categoryId,
                                            );
                                            const status = getBillStatus(bill, entries);
                                            const due = getBillDueInfo(bill, status);
                                            const active = billId === bill.id;
                                            return (
                                                <button
                                                    key={bill.id}
                                                    type="button"
                                                    onClick={() => setBillId(bill.id)}
                                                    className={cn(
                                                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                                                        active
                                                            ? "border-accent bg-accent-soft/60"
                                                            : "border-line bg-surface hover:border-line-strong",
                                                    )}
                                                >
                                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                                                        {billCategory?.emoji ?? "🧾"}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-xs font-semibold text-text">
                                                            {bill.title}
                                                        </span>
                                                        <span className="mt-0.5 block text-[10px] text-muted">
                                                            {due.label}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 text-right">
                                                        <span className="block text-xs font-bold tabular-nums text-liability">
                                                            {formatCents(remaining, currency)}
                                                        </span>
                                                        <span className="text-[10px] text-muted">
                                                            待还
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <AccountPicker
                                    label="从哪个账户还款"
                                    accounts={assetAccounts}
                                    value={assetAccountId}
                                    onChange={setAssetAccountId}
                                    emptyHint="还没有储蓄账户，请先到账户页添加"
                                />

                                {selectedBill && (
                                    <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-text">
                                            <Info className="size-3.5 text-accent" />
                                            还款不会重复计入支出
                                        </div>
                                        <div className="mt-2 space-y-1 text-[11px] text-muted">
                                            <div className="flex justify-between">
                                                <span>存款</span>
                                                <span className="tabular-nums">
                                                    {formatCents(assetBalance, currency)} →{" "}
                                                    {formatCents(
                                                        assetBalance - (parsedAmount ?? 0),
                                                        currency,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>负债</span>
                                                <span className="tabular-nums">
                                                    {formatCents(repaymentRemaining, currency)} →{" "}
                                                    {formatCents(repaymentProjected, currency)}
                                                </span>
                                            </div>
                                        </div>
                                        {parsedAmount !== null &&
                                            parsedAmount > 0 &&
                                            parsedAmount > assetBalance && (
                                                <p className="mt-2 text-[10px] leading-relaxed text-danger">
                                                    还款后该账户余额会变成负数，请确认余额。
                                                </p>
                                            )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted">
                            <CalendarDays className="size-3" />
                            日期
                        </span>
                        <input
                            type="date"
                            className="field"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">备注</span>
                        <input
                            className="field"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="可选"
                        />
                    </label>
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                            <MapPin className="size-3" />
                            位置
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                if (!navigator.geolocation) {
                                    toast("这个浏览器不支持定位", "info");
                                    return;
                                }
                                navigator.geolocation.getCurrentPosition(
                                    (position) => {
                                        setLocation((current) => ({
                                            lat: position.coords.latitude,
                                            lng: position.coords.longitude,
                                            label: current?.label,
                                        }));
                                        toast("已记录当前位置", "success");
                                    },
                                    () => toast("定位失败，请检查浏览器权限", "error"),
                                    { enableHighAccuracy: false, timeout: 10_000 },
                                );
                            }}
                            className="rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-muted transition hover:text-text"
                        >
                            获取当前位置
                        </button>
                    </div>
                    {location ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                className="field min-w-0 flex-1 py-2 text-xs"
                                value={location.label ?? ""}
                                onChange={(event) =>
                                    setLocation((current) =>
                                        current
                                            ? { ...current, label: event.target.value }
                                            : current,
                                    )
                                }
                                placeholder={`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                            />
                            <a
                                href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-medium text-accent hover:underline"
                            >
                                看地图
                            </a>
                            <button
                                type="button"
                                onClick={() => setLocation(undefined)}
                                className="grid size-6 place-items-center rounded text-muted hover:text-danger"
                                aria-label="清除位置"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ) : (
                        <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-2.5 text-[10px] text-muted">
                            可选，记录这笔消费发生的地点。
                        </p>
                    )}
                </div>

                <TagSelector
                    tags={tags}
                    groups={tagGroups}
                    value={tagIds}
                    onChange={setTagIds}
                />

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                            <Paperclip className="size-3" />
                            附件
                        </p>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-muted transition hover:text-text"
                        >
                            选择文件
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,application/pdf,text/plain"
                        className="hidden"
                        onChange={(event) => {
                            const next = Array.from(event.target.files ?? []);
                            event.target.value = "";
                            const tooLarge = next.find(
                                (file) => file.size > MAX_ATTACHMENT_SIZE,
                            );
                            if (tooLarge) {
                                setError(`单个附件不能超过 10 MB：${tooLarge.name}`);
                                return;
                            }
                            setFiles((current) => [...current, ...next]);
                        }}
                    />
                    {files.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-2.5 text-[10px] text-muted">
                            可选，小票 / 发票 / 截图，保存后会关联到这笔流水。
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {files.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/40 px-2.5 py-2 text-[11px]"
                                >
                                    <Paperclip className="size-3 shrink-0 text-muted" />
                                    <span className="min-w-0 flex-1 truncate text-text">
                                        {file.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFiles((current) =>
                                                current.filter((_, i) => i !== index),
                                            )
                                        }
                                        className="grid size-5 place-items-center rounded text-muted hover:text-danger"
                                        aria-label="移除附件"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
}

function AccountPicker({
    label,
    accounts,
    value,
    onChange,
    emptyHint,
}: {
    label: string;
    accounts: Array<{ id: string; name: string; emoji: string }>;
    value: string;
    onChange: (value: string) => void;
    emptyHint: string;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
            {accounts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-3 py-3 text-[11px] text-muted">
                    {emptyHint}
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {accounts.map((account) => (
                        <button
                            key={account.id}
                            type="button"
                            onClick={() => onChange(account.id)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition",
                                value === account.id
                                    ? "border-accent bg-accent-soft text-accent"
                                    : "border-line bg-surface text-text hover:border-line-strong",
                            )}
                        >
                            <span>{account.emoji}</span>
                            {account.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function CategoryPicker({
    label,
    categories,
    value,
    onChange,
}: {
    label: string;
    categories: Array<{
        id: string;
        name: string;
        emoji: string;
        color: string;
        parent?: string;
    }>;
    value: string;
    onChange: (value: string) => void;
}) {
    const parentNames = new Map(categories.map((category) => [category.id, category.name]));
    const ordered = [...categories].sort((a, b) => {
        const parentA = a.parent ?? "";
        const parentB = b.parent ?? "";
        if (parentA !== parentB) {
            return parentA.localeCompare(parentB);
        }
        return a.name.localeCompare(b.name, "zh-CN");
    });
    return (
        <div>
            <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
            {categories.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-3 py-3 text-[11px] text-muted">
                    还没有可用分类，请先到分类页添加。
                </p>
            ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {ordered.map((category) => {
                        const active = value === category.id;
                        const parentName = category.parent
                            ? parentNames.get(category.parent)
                            : undefined;
                        return (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => onChange(category.id)}
                                className={cn(
                                    "flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 transition",
                                    active
                                        ? "border-accent bg-accent-soft/70"
                                        : "border-line bg-surface hover:border-line-strong",
                                )}
                            >
                                <span
                                    className="grid size-8 place-items-center rounded-full text-base"
                                    style={{
                                        backgroundColor: `${category.color}20`,
                                    }}
                                >
                                    {category.emoji}
                                </span>
                                <span
                                    className={cn(
                                        "max-w-full truncate text-[10px] font-medium",
                                        active ? "text-accent" : "text-text",
                                    )}
                                >
                                    {parentName ? `${parentName} / ` : ""}
                                    {category.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MemberPicker({
    members,
    value,
    onChange,
}: {
    members: Array<{ id: string; name: string; color: string }>;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-semibold text-muted">成员</p>
            {members.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-2/50 px-3 py-3 text-[11px] text-muted">
                    还没有成员，请先到成员页添加。
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {members.map((member) => {
                        const active = value === member.id;
                        return (
                            <button
                                key={member.id}
                                type="button"
                                onClick={() => onChange(member.id)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition",
                                    active
                                        ? "border-accent bg-accent-soft text-accent"
                                        : "border-line bg-surface text-text hover:border-line-strong",
                                )}
                            >
                                <span
                                    className="grid size-5 place-items-center rounded-full text-[9px] font-bold text-white"
                                    style={{ backgroundColor: member.color }}
                                >
                                    {member.name.slice(0, 1)}
                                </span>
                                {member.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
