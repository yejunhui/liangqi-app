/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import type { CsvMapping, CsvTable, CsvTransaction } from "@/domain/csv";
import { parseCsvText, parseCsvTransactions, suggestCsvMapping } from "@/domain/csv";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { formatCents } from "@/domain/money";
import { formatDateFull } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

export function CsvImport() {
    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const addExpense = useLedgerStore((state) => state.addExpense);
    const addIncome = useLedgerStore((state) => state.addIncome);
    const currency = useCurrency();

    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState("");
    const [table, setTable] = useState<CsvTable | null>(null);
    const [mapping, setMapping] = useState<CsvMapping | null>(null);
    const [accountId, setAccountId] = useState("");
    const [expenseCategoryId, setExpenseCategoryId] = useState("");
    const [incomeCategoryId, setIncomeCategoryId] = useState("");
    const [error, setError] = useState("");

    const assetAccounts = accounts.filter((account) => account.kind === "asset");
    const expenseCategories = categories.filter((category) => category.kind === "expense");
    const incomeCategories = categories.filter((category) => category.kind === "income");

    const parsed = useMemo(() => {
        if (!table || !mapping) {
            return { transactions: [] as CsvTransaction[], skipped: 0 };
        }
        return parseCsvTransactions(table, mapping);
    }, [table, mapping]);

    const expenseTotal = parsed.transactions
        .filter((item) => item.kind === "expense")
        .reduce((sum, item) => sum + item.amount, 0);
    const incomeTotal = parsed.transactions
        .filter((item) => item.kind === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setError(t("CSV 文件不能超过 20 MB"));
            return;
        }
        try {
            const text = await file.text();
            const nextTable = parseCsvText(text);
            if (nextTable.headers.length === 0 || nextTable.rows.length === 0) {
                setError(t("无法识别这个 CSV 文件，请确认包含表头和交易记录"));
                return;
            }
            setFileName(file.name);
            setTable(nextTable);
            setMapping(suggestCsvMapping(nextTable.headers));
            setAccountId(assetAccounts[0]?.id ?? "");
            setExpenseCategoryId(expenseCategories[0]?.id ?? "");
            setIncomeCategoryId(incomeCategories[0]?.id ?? "");
            setError("");
        } catch {
            setError(t("无法读取这个 CSV 文件"));
        }
    }

    function updateMapping(key: keyof CsvMapping, value: number) {
        setMapping((current) => (current ? { ...current, [key]: value } : current));
    }

    function resolveCategory(transaction: CsvTransaction): string {
        const list = transaction.kind === "expense" ? expenseCategories : incomeCategories;
        const fallback =
            transaction.kind === "expense" ? expenseCategoryId : incomeCategoryId;
        if (transaction.categoryName) {
            const matched = list.find(
                (category) => category.name === transaction.categoryName,
            );
            if (matched) {
                return matched.id;
            }
        }
        return fallback;
    }

    function handleImport() {
        setError("");
        if (!accountId) {
            setError(t("请选择要导入到的账户"));
            return;
        }
        if (parsed.transactions.length === 0) {
            setError(t("没有可导入的交易，请检查列映射"));
            return;
        }
        let imported = 0;
        let failed = 0;
        for (const transaction of parsed.transactions) {
            const categoryId = resolveCategory(transaction);
            if (!categoryId) {
                failed += 1;
                continue;
            }
            const result =
                transaction.kind === "expense"
                    ? addExpense({
                          amount: transaction.amount,
                          date: transaction.date,
                          categoryId,
                          note: transaction.note,
                          source: { type: "asset", accountId },
                      })
                    : addIncome({
                          amount: transaction.amount,
                          date: transaction.date,
                          categoryId,
                          accountId,
                          note: transaction.note,
                      });
            if (result.ok) {
                imported += 1;
            } else {
                failed += 1;
            }
        }
        toast(
            failed > 0
                ? t("已导入 {0} 笔，{1} 笔失败", [imported, failed])
                : t("已导入 {0} 笔交易", [imported]),
            failed > 0 ? "info" : "success",
        );
        setTable(null);
        setMapping(null);
        setFileName("");
    }

    function resetFile() {
        setTable(null);
        setMapping(null);
        setFileName("");
        setError("");
    }

    const columns = table?.headers.map((header, index) => ({
        index,
        label: header || t("第 {0} 列", [index + 1]),
    })) ?? [];

    return (
        <div>
            <PageHeader
                eyebrow={t("通用记账")}
                title={t("导入账单")}
                description={t("支持微信、支付宝和银行导出的 CSV；导入前可以核对列映射和预览。")}
                action={
                    table ? (
                        <Button variant="secondary" onClick={resetFile}>
                            <X className="size-4" />{` ${t("重新选择")}`}</Button>
                    ) : (
                        <Button onClick={() => inputRef.current?.click()}>
                            <Upload className="size-4" />{` ${t("选择 CSV")}`}</Button>
                    )
                }
            />

            <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFile}
            />

            {!table ? (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="card flex w-full flex-col items-center justify-center gap-3 border-dashed px-6 py-16 text-center transition hover:border-line-strong"
                >
                    <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
                        <FileSpreadsheet className="size-6" />
                    </span>
                    <span className="text-sm font-semibold text-text">{t("选择微信 / 支付宝 / 银行 CSV")}</span>
                    <span className="max-w-md text-[11px] leading-relaxed text-muted">{t("文件只在本机解析和保存，不会上传。建议先在导出工具里选择包含「交易时间、金额、收/支」的明细。")}</span>
                </button>
            ) : (
                <div className="space-y-4">
                    <section className="card p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                                    <FileSpreadsheet className="size-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-text">{fileName}</p>
                                    <p className="mt-0.5 text-[10px] text-muted">
                                        {table.rows.length}{` ${t("行 · 识别到")} `}{table.headers.length}{` ${t("列")}`}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 text-right text-[10px] text-muted">
                                <div>
                                    <p>{t("支出合计")}</p>
                                    <p className="mt-0.5 text-xs font-bold text-text">
                                        {formatCents(expenseTotal, currency)}
                                    </p>
                                </div>
                                <div>
                                    <p>{t("收入合计")}</p>
                                    <p className="mt-0.5 text-xs font-bold text-success">
                                        {formatCents(incomeTotal, currency)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {mapping && (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <MappingSelect
                                    label={t("交易时间")}
                                    value={mapping.date}
                                    columns={columns}
                                    onChange={(value) => updateMapping("date", value)}
                                />
                                <MappingSelect
                                    label={t("金额")}
                                    value={mapping.amount}
                                    columns={columns}
                                    onChange={(value) => updateMapping("amount", value)}
                                />
                                <MappingSelect
                                    label={t("收 / 支")}
                                    value={mapping.type}
                                    columns={columns}
                                    optional
                                    onChange={(value) => updateMapping("type", value)}
                                />
                                <MappingSelect
                                    label={t("分类")}
                                    value={mapping.category}
                                    columns={columns}
                                    optional
                                    onChange={(value) => updateMapping("category", value)}
                                />
                                <MappingSelect
                                    label={t("备注")}
                                    value={mapping.note}
                                    columns={columns}
                                    optional
                                    onChange={(value) => updateMapping("note", value)}
                                />
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("导入到账户")}</span>
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
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("默认支出分类")}</span>
                                    <select
                                        className="field"
                                        value={expenseCategoryId}
                                        onChange={(event) =>
                                            setExpenseCategoryId(event.target.value)
                                        }
                                    >
                                        {expenseCategories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.emoji} {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("默认收入分类")}</span>
                                    <select
                                        className="field"
                                        value={incomeCategoryId}
                                        onChange={(event) =>
                                            setIncomeCategoryId(event.target.value)
                                        }
                                    >
                                        {incomeCategories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.emoji} {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        )}

                        <p className="mt-3 text-[10px] leading-relaxed text-muted">{t(
                            "分类按名称自动匹配已有分类；没有匹配时使用默认分类。CSV\n                            里的「不计收支 / 转账 / 还款」记录会被跳过。"
                        )}</p>
                    </section>

                    <section className="card overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/45 px-4 py-3">
                            <div>
                                <h2 className="text-sm font-bold text-text">{t("导入预览")}</h2>
                                <p className="mt-0.5 text-[10px] text-muted">{`${t("将导入")} `}{parsed.transactions.length}{` ${t("笔，跳过")}`}{" "}
                                    {parsed.skipped}{` ${t("笔")}`}</p>
                            </div>
                            <Button
                                onClick={handleImport}
                                disabled={parsed.transactions.length === 0}
                            >
                                <Upload className="size-4" />{` ${t("导入")} `}{parsed.transactions.length}{` ${t("笔")}`}</Button>
                        </div>

                        {parsed.transactions.length === 0 ? (
                            <p className="px-4 py-10 text-center text-xs text-muted">{t("没有可导入的交易，请检查「交易时间」和「金额」列映射。")}</p>
                        ) : (
                            <div className="divide-y divide-line/60">
                                {parsed.transactions.slice(0, 12).map((transaction, index) => {
                                    const categoryId = resolveCategory(transaction);
                                    const category = categories.find(
                                        (item) => item.id === categoryId,
                                    );
                                    return (
                                        <div
                                            key={`${transaction.date}-${index}`}
                                            className="flex items-center gap-3 px-4 py-2.5"
                                        >
                                            <span className="w-24 shrink-0 text-[10px] text-muted">
                                                {formatDateFull(transaction.date)}
                                            </span>
                                            <span
                                                className={cn(
                                                    "chip shrink-0",
                                                    transaction.kind === "income"
                                                        ? "bg-success-soft text-success"
                                                        : "bg-liability-soft text-liability",
                                                )}
                                            >
                                                {transaction.kind === "income" ? t("收入") : t("支出")}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-xs text-text">
                                                {transaction.note ?? t("无备注")}
                                                {category ? (
                                                    <span className="ml-1.5 text-[10px] text-muted">
                                                        · {category.emoji} {category.name}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span
                                                className={cn(
                                                    "shrink-0 text-xs font-bold tabular-nums",
                                                    transaction.kind === "income"
                                                        ? "text-success"
                                                        : "text-text",
                                                )}
                                            >
                                                {formatCents(transaction.amount, currency)}
                                            </span>
                                        </div>
                                    );
                                })}
                                {parsed.transactions.length > 12 && (
                                    <p className="px-4 py-2.5 text-center text-[10px] text-muted">{`${t("还有")} `}{parsed.transactions.length - 12}{` ${t("笔未显示")}`}</p>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {error && (
                <p className="mt-4 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}

function MappingSelect({
    label,
    value,
    columns,
    optional = false,
    onChange,
}: {
    label: string;
    value: number;
    columns: Array<{ index: number; label: string }>;
    optional?: boolean;
    onChange: (value: number) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
            <select
                className="field"
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            >
                {optional && <option value={-1}>{t("不导入")}</option>}
                {!optional && value === -1 && <option value={-1}>{t("请选择列")}</option>}
                {columns.map((column) => (
                    <option key={column.index} value={column.index}>
                        {column.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
