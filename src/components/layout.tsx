/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from "react";
import {
    Home,
    ReceiptText,
    CreditCard,
    WalletCards,
    Tags,
    Settings,
    Plus,
    ChevronDown,
    Database,
    Cloud,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";
import { BookSwitcher } from "@/components/book-switcher";
import { useLedgerStore, useCurrency } from "@/store/ledger";
import { useLibraryStore, getActiveBook } from "@/store/library";
import { useUIStore } from "@/store/ui";
import { getTotals } from "@/domain/ledger";
import { formatCents } from "@/domain/money";
import { cn } from "@/utils/cn";

const primaryNav = [
    { to: "/", label: "首页", icon: Home, end: true },
    { to: "/entries", label: "流水", icon: ReceiptText },
    { to: "/bills", label: "账单", icon: CreditCard },
    { to: "/accounts", label: "账户", icon: WalletCards },
];

const secondaryNav = [
    { to: "/categories", label: "分类", icon: Tags },
    { to: "/data", label: "数据源", icon: Cloud },
    { to: "/settings", label: "设置", icon: Settings },
];

function navClass(active: boolean): string {
    return cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active
            ? "bg-accent-soft text-accent"
            : "text-muted hover:bg-surface-2 hover:text-text",
    );
}

export function Layout() {
    const location = useLocation();
    const accounts = useLedgerStore((state) => state.accounts);
    const entries = useLedgerStore((state) => state.entries);
    const currency = useCurrency();
    const openEntryModal = useUIStore((state) => state.openEntryModal);
    const closeEntryModal = useUIStore((state) => state.closeEntryModal);
    const openBookSwitcher = useUIStore((state) => state.openBookSwitcher);
    const activeBook = useLibraryStore((state) => getActiveBook(state));
    const totals = getTotals({ accounts, entries });

    useEffect(() => {
        window.scrollTo(0, 0);
        closeEntryModal();
    }, [location.pathname, closeEntryModal]);

    return (
        <div className="min-h-dvh">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/75 backdrop-blur-xl md:flex">
                <div className="px-5 pb-4 pt-6">
                    <Logo />
                </div>

                <div className="px-3">
                    <button
                        type="button"
                        onClick={openBookSwitcher}
                        className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2/55 px-3 py-2 text-left transition hover:border-line-strong"
                    >
                        <Database className="size-4 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1">
                            <span className="block text-[9px] font-medium uppercase tracking-[0.12em] text-muted">
                                当前账本
                            </span>
                            <span className="mt-0.5 block truncate text-xs font-semibold text-text">
                                {activeBook.name}
                            </span>
                        </span>
                        <ChevronDown className="size-3.5 shrink-0 text-muted" />
                    </button>
                </div>

                <div className="mt-3 px-3">
                    <Button
                        className="w-full shadow-sm"
                        onClick={() => openEntryModal()}
                    >
                        <Plus className="size-4" />
                        记一笔
                    </Button>
                </div>

                <nav className="mt-6 flex-1 space-y-1 px-3">
                    {primaryNav.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => navClass(isActive)}
                        >
                            <item.icon className="size-[18px]" />
                            {item.label}
                        </NavLink>
                    ))}
                    <div className="my-3 border-t border-line" />
                    {secondaryNav.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => navClass(isActive)}
                        >
                            <item.icon className="size-[18px]" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="m-3 rounded-2xl border border-line bg-surface-2/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                        净资产
                    </p>
                    <p className="mt-1.5 text-xl font-bold tracking-tight text-text">
                        {formatCents(totals.netWorth, currency)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                        <span>资产 {formatCents(totals.assets, currency)}</span>
                        <span className="text-liability">
                            负债 {formatCents(totals.liabilities, currency)}
                        </span>
                    </div>
                </div>
            </aside>

            <div className="md:pl-64">
                <header className="sticky top-0 z-30 border-b border-line bg-bg/75 backdrop-blur-xl md:hidden">
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <Logo />
                            <button
                                type="button"
                                onClick={openBookSwitcher}
                                className="flex min-w-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-text transition hover:border-line-strong"
                            >
                                <Database className="size-3.5 shrink-0 text-accent" />
                                <span className="max-w-[5.5rem] truncate">{activeBook.name}</span>
                                <ChevronDown className="size-3 shrink-0 text-muted" />
                            </button>
                        </div>
                        <NavLink
                            to="/settings"
                            className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:text-text"
                            aria-label="设置"
                        >
                            <Settings className="size-4" />
                        </NavLink>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-10">
                    <div key={location.pathname} className="animate-rise">
                        <Outlet />
                    </div>
                </main>
            </div>

            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden">
                <div className="mx-auto flex max-w-md items-end justify-between">
                    {primaryNav.slice(0, 2).map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                cn(
                                    "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition",
                                    isActive ? "text-accent" : "text-muted",
                                )
                            }
                        >
                            <item.icon className="size-5" />
                            {item.label}
                        </NavLink>
                    ))}

                    <div className="flex w-16 justify-center">
                        <button
                            type="button"
                            onClick={() => openEntryModal()}
                            className="-mt-5 grid size-14 place-items-center rounded-2xl border-4 border-bg bg-accent text-surface shadow-lg transition active:scale-95"
                            aria-label="记一笔"
                        >
                            <Plus className="size-6" />
                        </button>
                    </div>

                    {primaryNav.slice(2).map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition",
                                    isActive ? "text-accent" : "text-muted",
                                )
                            }
                        >
                            <item.icon className="size-5" />
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </nav>

            <BookSwitcher />
        </div>
    );
}
