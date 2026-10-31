/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    Download,
    FileJson,
    Info,
    Monitor,
    Moon,
    RotateCcw,
    ShieldCheck,
    Sun,
    Tags,
    Upload,
} from "lucide-react";
import type { LedgerData, ThemeMode } from "@/types";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createExportPayload, parseBackup } from "@/domain/backup";
import { downloadJson } from "@/utils/download";
import { toDateInputValue } from "@/utils/date";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

const CURRENCIES = [
    { value: "CNY", label: "人民币 CNY" },
    { value: "USD", label: "美元 USD" },
    { value: "EUR", label: "欧元 EUR" },
    { value: "JPY", label: "日元 JPY" },
    { value: "GBP", label: "英镑 GBP" },
    { value: "HKD", label: "港币 HKD" },
    { value: "TWD", label: "新台币 TWD" },
    { value: "KRW", label: "韩元 KRW" },
    { value: "THB", label: "泰铢 THB" },
    { value: "SGD", label: "新加坡元 SGD" },
    { value: "AUD", label: "澳元 AUD" },
    { value: "CAD", label: "加元 CAD" },
];

const THEMES: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
    { value: "system", label: "跟随系统", icon: Monitor },
];

export function Settings() {
    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const bills = useLedgerStore((state) => state.bills);
    const entries = useLedgerStore((state) => state.entries);
    const settings = useLedgerStore((state) => state.settings);
    const setSettings = useLedgerStore((state) => state.setSettings);
    const importData = useLedgerStore((state) => state.importData);
    const resetData = useLedgerStore((state) => state.resetData);

    const inputRef = useRef<HTMLInputElement>(null);
    const [pendingImport, setPendingImport] = useState<LedgerData | null>(null);
    const [resetOpen, setResetOpen] = useState(false);

    function handleExport() {
        const payload = createExportPayload({
            accounts,
            categories,
            bills,
            entries,
            settings,
        });
        downloadJson(`liangqi-backup-${toDateInputValue(Date.now())}.json`, payload);
        toast("备份已导出", "success");
    }

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            toast("备份文件不能超过 20 MB", "error");
            return;
        }
        try {
            const text = await file.text();
            const raw: unknown = JSON.parse(text);
            const result = parseBackup(raw);
            if (!result.ok) {
                toast(result.error, "error");
                return;
            }
            setPendingImport(result.data);
        } catch {
            toast("无法读取这个 JSON 文件", "error");
        }
    }

    function handleImport() {
        if (!pendingImport) {
            return;
        }
        const result = importData(pendingImport);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast("备份已导入，当前账本已被替换", "success");
        setPendingImport(null);
    }

    return (
        <div>
            <PageHeader
                title="设置"
                description="外观、货币和数据管理。所有账目默认只保存在本机浏览器里。"
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <section className="card p-5">
                    <SectionTitle
                        icon={Sun}
                        title="外观"
                        description="切换浅色、深色，或跟随系统。"
                    />
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        {THEMES.map((theme) => {
                            const active = settings.theme === theme.value;
                            return (
                                <button
                                    key={theme.value}
                                    type="button"
                                    onClick={() => setSettings({ theme: theme.value })}
                                    className={cn(
                                        "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition",
                                        active
                                            ? "border-accent bg-accent-soft text-accent"
                                            : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                                    )}
                                >
                                    <theme.icon className="size-4" />
                                    {theme.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={FileJson}
                        title="货币"
                        description="只改变显示符号，不做汇率换算。"
                    />
                    <select
                        className="field mt-4"
                        value={settings.currency}
                        onChange={(event) => setSettings({ currency: event.target.value })}
                    >
                        {!CURRENCIES.some(
                            (currency) => currency.value === settings.currency,
                        ) && (
                            <option value={settings.currency}>{settings.currency}</option>
                        )}
                        {CURRENCIES.map((currency) => (
                            <option key={currency.value} value={currency.value}>
                                {currency.label}
                            </option>
                        ))}
                    </select>
                    <p className="mt-2 text-[10px] text-muted">
                        已经记下的金额不会因为切换货币而改变数值。
                    </p>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Tags}
                        title="分类管理"
                        description={`当前有 ${categories.filter((category) => category.kind === "expense").length} 个支出分类、${categories.filter((category) => category.kind === "income").length} 个收入分类。`}
                    />
                    <Link
                        to="/categories"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >
                        打开分类管理
                        <ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={ShieldCheck}
                        title="账务规则"
                        description="两讫只做三件事，保证支出不被重复计算。"
                    />
                    <ul className="mt-4 space-y-2 text-[11px]">
                        <RuleRow label="现金消费" detail="资产 ↓ 100 · 支出 ↑ 100" />
                        <RuleRow label="赊账消费" detail="负债 ↑ 100 · 支出 ↑ 100" />
                        <RuleRow label="还款" detail="资产 ↓ 100 · 负债 ↓ 100" />
                    </ul>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">
                        还款是资产和负债之间的转移，不会再记一笔支出。
                    </p>
                </section>

                <section className="card p-5 lg:col-span-2">
                    <SectionTitle
                        icon={FileJson}
                        title="数据管理"
                        description="数据默认保存在浏览器 localStorage。建议定期导出备份。"
                    />
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3 text-left transition hover:border-line-strong"
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                                <Download className="size-4" />
                            </span>
                            <span>
                                <span className="block text-xs font-semibold text-text">导出备份</span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    JSON 文件
                                </span>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3 text-left transition hover:border-line-strong"
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-success-soft text-success">
                                <Upload className="size-4" />
                            </span>
                            <span>
                                <span className="block text-xs font-semibold text-text">导入备份</span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    替换当前数据
                                </span>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setResetOpen(true)}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3 text-left transition hover:border-danger/30 hover:bg-danger-soft/40"
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-danger-soft text-danger">
                                <RotateCcw className="size-4" />
                            </span>
                            <span>
                                <span className="block text-xs font-semibold text-text">恢复初始数据</span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                    清空当前账本
                                </span>
                            </span>
                        </button>
                    </div>

                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleFile}
                    />

                    <div className="mt-4 flex gap-2 rounded-xl border border-line bg-surface-2/40 p-3 text-[10px] leading-relaxed text-muted">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
                        <span>
                            导出文件包含账户、分类、账单和全部流水。导入会替换当前全部数据，请先导出备份。
                        </span>
                    </div>
                </section>

                <section className="card p-5 lg:col-span-2">
                    <SectionTitle
                        icon={ShieldCheck}
                        title="关于两讫"
                        description="本地优先的负债记账本。"
                    />
                    <div className="mt-4 grid gap-3 text-[11px] leading-relaxed text-muted sm:grid-cols-2">
                        <div className="rounded-xl border border-line bg-surface-2/55 p-3.5">
                            <p className="font-semibold text-text">版本</p>
                            <p className="mt-1">0.1.0 · 数据格式 v1</p>
                        </div>
                        <div className="rounded-xl border border-line bg-surface-2/55 p-3.5">
                            <p className="font-semibold text-text">许可证</p>
                            <p className="mt-1">
                                代码以{" "}
                                <a
                                    href="https://www.gnu.org/licenses/gpl-3.0.html"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-accent hover:underline"
                                >
                                    GNU GPL-3.0-or-later
                                </a>{" "}
                                发布。
                            </p>
                        </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">
                        两讫是独立实现。功能思路受{" "}
                        <a
                            href="https://github.com/glink25/Cent"
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-accent hover:underline"
                        >
                            Cent
                        </a>{" "}
                        启发；Cent 版权归 glink25 所有，采用 CC BY-NC-SA 4.0。本项目未复制 Cent
                        的源代码、文案或素材。名称「两讫」与双栏 Logo 为原创；界面图标使用
                        Lucide（ISC）和系统 Emoji。
                    </p>
                </section>
            </div>

            <ConfirmDialog
                open={resetOpen}
                onClose={() => setResetOpen(false)}
                title="恢复初始数据？"
                description="当前账户、账单、流水和分类都会被清空，并恢复为默认账户和分类。建议先导出备份。"
                confirmLabel="恢复初始数据"
                onConfirm={() => {
                    resetData();
                    toast("已恢复初始数据", "success");
                }}
            />

            <ConfirmDialog
                open={pendingImport !== null}
                onClose={() => setPendingImport(null)}
                title="导入并替换当前账本？"
                description={
                    pendingImport
                        ? `备份包含 ${pendingImport.accounts.length} 个账户、${pendingImport.bills.length} 张账单、${pendingImport.entries.length} 条流水。当前数据会被完全替换。`
                        : ""
                }
                confirmLabel="导入"
                tone="primary"
                onConfirm={handleImport}
            />
        </div>
    );
}

function SectionTitle({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof Sun;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                <Icon className="size-4" />
            </span>
            <div>
                <h2 className="text-sm font-bold text-text">{title}</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{description}</p>
            </div>
        </div>
    );
}

function RuleRow({ label, detail }: { label: string; detail: string }) {
    return (
        <li className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/55 px-3 py-2">
            <span className="font-medium text-text">{label}</span>
            <span className="tabular-nums text-muted">{detail}</span>
        </li>
    );
}
