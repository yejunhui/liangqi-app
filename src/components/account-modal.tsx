/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Account, AccountKind } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { parseAmountToCents, currencySymbol } from "@/domain/money";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

const EMOJI_SUGGESTIONS = [
    "💵",
    "🏦",
    "💳",
    "📱",
    "👛",
    "🪙",
    "💸",
    "🧾",
    "🏧",
    "💰",
    "📈",
    "🔖",
];

interface AccountModalProps {
    open: boolean;
    account: Account | null;
    defaultKind: AccountKind;
    onClose: () => void;
}

export function AccountModal({ open, account, defaultKind, onClose }: AccountModalProps) {
    const addAccount = useLedgerStore((state) => state.addAccount);
    const updateAccount = useLedgerStore((state) => state.updateAccount);
    const currency = useCurrency();

    const [name, setName] = useState("");
    const [kind, setKind] = useState<AccountKind>("asset");
    const [emoji, setEmoji] = useState("💵");
    const [openingBalance, setOpeningBalance] = useState("");
    const [liquid, setLiquid] = useState(true);
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        if (account) {
            setName(account.name);
            setKind(account.kind);
            setEmoji(account.emoji);
            setOpeningBalance((account.openingBalance / 100).toFixed(2));
            setLiquid(account.liquid !== false);
            setNote(account.note ?? "");
        } else {
            setName("");
            setKind(defaultKind);
            setEmoji(defaultKind === "liability" ? "💳" : "💵");
            setOpeningBalance("");
            setLiquid(true);
            setNote("");
        }
        setError("");
    }, [open, account, defaultKind]);

    const editing = account !== null;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (editing) {
            const result = updateAccount(account.id, {
                name,
                emoji,
                note,
                ...(account.kind === "asset" ? { liquid } : {}),
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            toast("账户已更新", "success");
            onClose();
            return;
        }

        const openingCents = openingBalance.trim() === "" ? 0 : parseAmountToCents(openingBalance);
        if (openingCents === null) {
            setError("期初余额格式不正确");
            return;
        }

        const result = addAccount({
            name,
            kind,
            emoji,
            openingBalance: openingCents,
            liquid: kind === "asset" ? liquid : undefined,
            note,
        });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(kind === "liability" ? "负债账户已创建" : "资产账户已创建", "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "编辑账户" : "添加账户"}
            description={
                editing
                    ? "账户类型和期初余额创建后不可修改，避免历史账目错乱。"
                    : "资产是存款，负债是待还的钱。赊账会记到负债账户里。"
            }
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        取消
                    </Button>
                    <Button type="submit" form="account-form" className="flex-1">
                        {editing ? "保存" : "创建账户"}
                    </Button>
                </div>
            }
        >
            <form id="account-form" className="space-y-4" onSubmit={handleSubmit}>
                {!editing && (
                    <div>
                        <p className="mb-2 text-xs font-semibold text-muted">账户类型</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setKind("asset");
                                    setEmoji("💵");
                                }}
                                className={cn(
                                    "rounded-xl border p-3 text-left transition",
                                    kind === "asset"
                                        ? "border-accent bg-accent-soft/70"
                                        : "border-line bg-surface hover:border-line-strong",
                                )}
                            >
                                <span className="text-lg">💵</span>
                                <span className="mt-1 block text-xs font-semibold text-text">
                                    资产
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    现金、银行卡、余额
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setKind("liability");
                                    setEmoji("💳");
                                }}
                                className={cn(
                                    "rounded-xl border p-3 text-left transition",
                                    kind === "liability"
                                        ? "border-liability bg-liability-soft/70"
                                        : "border-line bg-surface hover:border-line-strong",
                                )}
                            >
                                <span className="text-lg">💳</span>
                                <span className="mt-1 block text-xs font-semibold text-text">
                                    负债
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    信用卡、借款、待还
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">账户名称</span>
                    <input
                        className="field"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={kind === "liability" ? "例如：信用卡、花呗、借款" : "例如：工资卡"}
                        autoFocus
                    />
                </label>

                <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">图标</p>
                    <div className="flex flex-wrap gap-1.5">
                        {EMOJI_SUGGESTIONS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setEmoji(item)}
                                className={cn(
                                    "grid size-8 place-items-center rounded-lg border text-sm transition",
                                    emoji === item
                                        ? "border-accent bg-accent-soft"
                                        : "border-line bg-surface hover:border-line-strong",
                                )}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                {(editing ? account.kind : kind) === "asset" && (
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                        <span>
                            <span className="block text-xs font-semibold text-text">
                                计入可支配资产
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                                现金、银行卡等流动资产。房产、投资等可以关闭。
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={liquid}
                            onChange={(event) => setLiquid(event.target.checked)}
                            className="size-4 shrink-0 accent-[var(--accent)]"
                        />
                    </label>
                )}

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">
                        期初余额
                        {!editing && kind === "liability" && (
                            <span className="ml-1 font-normal text-liability">
                                · 会生成期初负债账单
                            </span>
                        )}
                    </span>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                            {currencySymbol(currency)}
                        </span>
                        <input
                            className="field pl-8"
                            inputMode="decimal"
                            value={openingBalance}
                            onChange={(event) => setOpeningBalance(event.target.value)}
                            placeholder="0.00"
                            disabled={editing}
                        />
                    </div>
                    {editing && (
                        <span className="mt-1 block text-[10px] text-muted">
                            期初余额不可修改，请通过流水或还款调整。
                        </span>
                    )}
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

                {error && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
}
