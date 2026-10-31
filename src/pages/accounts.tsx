/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from "react";
import { CreditCard, Landmark, Plus, WalletCards } from "lucide-react";
import type { Account, AccountKind, Entry } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { AccountCard } from "@/components/account-card";
import { AccountModal } from "@/components/account-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import {
    getAccountBalance,
    getOpenBills,
    getTotals,
} from "@/domain/ledger";
import { formatCents } from "@/domain/money";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

export function Accounts() {
    const accounts = useLedgerStore((state) => state.accounts);
    const entries = useLedgerStore((state) => state.entries);
    const bills = useLedgerStore((state) => state.bills);
    const deleteAccount = useLedgerStore((state) => state.deleteAccount);
    const currency = useCurrency();

    const [modalOpen, setModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [defaultKind, setDefaultKind] = useState<AccountKind>("asset");
    const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

    const totals = useMemo(() => getTotals({ accounts, entries }), [accounts, entries]);
    const assetAccounts = useMemo(
        () => accounts.filter((account) => account.kind === "asset"),
        [accounts],
    );
    const liabilityAccounts = useMemo(
        () => accounts.filter((account) => account.kind === "liability"),
        [accounts],
    );
    const openBills = useMemo(() => getOpenBills(bills, entries), [bills, entries]);

    const totalForBar = Math.max(1, totals.assets + Math.max(0, totals.liabilities));
    const assetShare = (Math.max(0, totals.assets) / totalForBar) * 100;

    function openCreate(kind: AccountKind) {
        setEditingAccount(null);
        setDefaultKind(kind);
        setModalOpen(true);
    }

    function openEdit(account: Account) {
        setDefaultKind(account.kind);
        setEditingAccount(account);
        setModalOpen(true);
    }

    function handleDelete() {
        if (!deletingAccount) {
            return;
        }
        const result = deleteAccount(deletingAccount.id);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast("账户已删除", "success");
        setDeletingAccount(null);
    }

    return (
        <div>
            <PageHeader
                title="账户"
                description="资产是现在能用的钱，负债是以后要还的钱。净资产 = 资产 − 负债。"
                action={
                    <Button onClick={() => openCreate("asset")}>
                        <Plus className="size-4" />
                        添加账户
                    </Button>
                }
            />

            <section className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-medium text-muted">净资产</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-text">
                            {formatCents(totals.netWorth, currency)}
                        </p>
                    </div>
                    <div className="flex gap-6">
                        <div>
                            <p className="flex items-center gap-1.5 text-[10px] text-muted">
                                <span className="size-2 rounded-full bg-accent" />
                                资产
                            </p>
                            <p className="mt-1 text-base font-bold tabular-nums text-text">
                                {formatCents(totals.assets, currency)}
                            </p>
                        </div>
                        <div>
                            <p className="flex items-center gap-1.5 text-[10px] text-muted">
                                <span className="size-2 rounded-full bg-liability" />
                                负债
                            </p>
                            <p className="mt-1 text-base font-bold tabular-nums text-liability">
                                {formatCents(totals.liabilities, currency)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-surface-3">
                    {totals.assets !== 0 && (
                        <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${Math.max(2, assetShare)}%` }}
                        />
                    )}
                    {totals.liabilities !== 0 && (
                        <div className="h-full flex-1 bg-liability transition-all" />
                    )}
                </div>
                <p className="mt-2 text-[10px] text-muted">
                    这条比例只展示资产与负债的相对大小，不代表还款进度。
                </p>
            </section>

            <AccountSection
                title="资产账户"
                description="现金、银行卡、支付宝、微信余额"
                total={totals.assets}
                currency={currency}
                accounts={assetAccounts}
                onAdd={() => openCreate("asset")}
                onEdit={openEdit}
                onDelete={setDeletingAccount}
                emptyTitle="还没有资产账户"
                emptyDescription="先添加一个现金或银行卡账户，支出才能从里面扣。"
                emptyActionLabel="添加资产账户"
                entries={entries}
            />

            <AccountSection
                title="负债账户"
                description="信用卡、借款、花呗等以后要还的钱"
                total={totals.liabilities}
                currency={currency}
                accounts={liabilityAccounts}
                onAdd={() => openCreate("liability")}
                onEdit={openEdit}
                onDelete={setDeletingAccount}
                emptyTitle="还没有负债账户"
                emptyDescription="添加信用卡或借款账户，赊账消费会记到这里。"
                emptyActionLabel="添加负债账户"
                entries={entries}
                billCounts={openBills}
            />

            <AccountModal
                open={modalOpen}
                account={editingAccount}
                defaultKind={defaultKind}
                onClose={() => {
                    setModalOpen(false);
                    setEditingAccount(null);
                }}
            />

            <ConfirmDialog
                open={deletingAccount !== null}
                onClose={() => setDeletingAccount(null)}
                title="删除这个账户？"
                description={
                    deletingAccount
                        ? `“${deletingAccount.name}”只有在没有任何流水和账单时才能删除。`
                        : ""
                }
                confirmLabel="删除"
                onConfirm={handleDelete}
            />
        </div>
    );
}

function AccountSection({
    title,
    description,
    total,
    currency,
    accounts,
    onAdd,
    onEdit,
    onDelete,
    emptyTitle,
    emptyDescription,
    emptyActionLabel,
    entries,
    billCounts,
}: {
    title: string;
    description: string;
    total: number;
    currency: string;
    accounts: Account[];
    onAdd: () => void;
    onEdit: (account: Account) => void;
    onDelete: (account: Account) => void;
    emptyTitle: string;
    emptyDescription: string;
    emptyActionLabel: string;
    entries: Entry[];
    billCounts?: ReturnType<typeof getOpenBills>;
}) {
    const isLiability = title.includes("负债");

    return (
        <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                "grid size-7 place-items-center rounded-lg",
                                isLiability
                                    ? "bg-liability-soft text-liability"
                                    : "bg-accent-soft text-accent",
                            )}
                        >
                            {isLiability ? (
                                <CreditCard className="size-3.5" />
                            ) : (
                                <Landmark className="size-3.5" />
                            )}
                        </span>
                        <h2 className="text-sm font-bold text-text">{title}</h2>
                        <span className="text-xs font-semibold tabular-nums text-muted">
                            {formatCents(total, currency)}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{description}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={onAdd}>
                    <Plus className="size-3.5" />
                    添加
                </Button>
            </div>

            {accounts.length === 0 ? (
                <EmptyState
                    icon={isLiability ? CreditCard : WalletCards}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={
                        <Button size="sm" variant="secondary" onClick={onAdd}>
                            <Plus className="size-3.5" />
                            {emptyActionLabel}
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((account) => (
                        <AccountCard
                            key={account.id}
                            account={account}
                            balance={getAccountBalance(account, entries)}
                            currency={currency}
                            billCount={
                                billCounts?.filter(
                                    (bill) => bill.liabilityAccountId === account.id,
                                ).length
                            }
                            onEdit={() => onEdit(account)}
                            onDelete={() => onDelete(account)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
