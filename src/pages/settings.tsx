/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    Bot,
    ChartNoAxesColumn,
    Cloud,
    Download,
    FileJson,
    Info,
    Keyboard,
    Languages,
    LockKeyhole,
    Monitor,
    Moon,
    Palette,
    RotateCcw,
    ShieldCheck,
    Sun,
    Tag,
    Tags,
    Target,
    Repeat,
    FileSpreadsheet,
    Upload,
    UserRound,
    Users,
} from "lucide-react";
import type { LedgerData, LibraryData, ThemeMode } from "@/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PasswordModal, type PasswordMode } from "@/components/password-modal";
import {
    createExportPayload,
    createLibraryExport,
    parseBackup,
    parseLibraryBackup,
} from "@/domain/backup";
import { downloadJson } from "@/utils/download";
import { toDateInputValue } from "@/utils/date";
import { CURRENCIES } from "@/domain/currencies";
import { clearExchangeRateCache } from "@/domain/exchange-rates";
import { useLedgerStore } from "@/store/ledger";
import {
    extractLibrary,
    getActiveBook,
    useLibraryStore,
} from "@/store/library";
import { useAuthStore } from "@/store/auth";
import { isAiConfigured, useAiStore } from "@/store/ai";
import { useActiveMember } from "@/store/member-session";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import {
    getLanguage,
    LANGUAGES,
    setLanguage,
    t,
    type Language,
} from "@/i18n";

const THEMES: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: "light", label: t("浅色"), icon: Sun },
    { value: "dark", label: t("深色"), icon: Moon },
    { value: "system", label: t("跟随系统"), icon: Monitor },
];

export function Settings() {
    const accounts = useLedgerStore((state) => state.accounts);
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tagGroups = useLedgerStore((state) => state.tagGroups);
    const tags = useLedgerStore((state) => state.tags);
    const budgets = useLedgerStore((state) => state.budgets);
    const recurringRules = useLedgerStore((state) => state.recurringRules);
    const attachments = useLedgerStore((state) => state.attachments);
    const deletedEntries = useLedgerStore((state) => state.deletedEntries);
    const deletedBills = useLedgerStore((state) => state.deletedBills);
    const deletedConfig = useLedgerStore((state) => state.deletedConfig);
    const bills = useLedgerStore((state) => state.bills);
    const entries = useLedgerStore((state) => state.entries);
    const settings = useLedgerStore((state) => state.settings);
    const setSettings = useLedgerStore((state) => state.setSettings);
    const importData = useLedgerStore((state) => state.importData);
    const resetData = useLedgerStore((state) => state.resetData);
    const library = useLibraryStore();
    const activeBook = getActiveBook(library);
    const authEnabled = useAuthStore((state) => state.enabled);
    const lock = useAuthStore((state) => state.lock);
    const ai = useAiStore();
    const activeMember = useActiveMember();
    const openMemberModal = useUIStore((state) => state.openMemberModal);
    const language = getLanguage();

    const [aiEndpoint, setAiEndpoint] = useState(ai.endpoint);
    const [aiModel, setAiModel] = useState(ai.model);
    const [aiApiKey, setAiApiKey] = useState(ai.apiKey);
    const [customCurrency, setCustomCurrency] = useState("");
    const [customCss, setCustomCss] = useState(settings.customCss ?? "");
    const quickEntryUrl =
        typeof window === "undefined"
            ? ""
            : `${window.location.origin}${window.location.pathname}#/quick?text=`;

    const inputRef = useRef<HTMLInputElement>(null);
    const [pendingImport, setPendingImport] = useState<LedgerData | null>(null);
    const [pendingLibrary, setPendingLibrary] = useState<LibraryData | null>(null);
    const [resetOpen, setResetOpen] = useState(false);
    const [passwordMode, setPasswordMode] = useState<PasswordMode | null>(null);

    function handleExportCurrent() {
        const payload = createExportPayload({
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
        });
        downloadJson(`liangqi-book-${toDateInputValue(Date.now())}.json`, payload);
        toast(t("当前账本已导出"), "success");
    }

    function handleExportLibrary() {
        const payload = createLibraryExport(
            extractLibrary(useLibraryStore.getState()),
        );
        downloadJson(`liangqi-library-${toDateInputValue(Date.now())}.json`, payload);
        toast(t("全部账本已导出"), "success");
    }

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            toast(t("备份文件不能超过 20 MB"), "error");
            return;
        }
        try {
            const text = await file.text();
            const raw: unknown = JSON.parse(text);
            if (
                typeof raw === "object" &&
                raw !== null &&
                "version" in raw &&
                (raw as { version?: unknown }).version === 2
            ) {
                const result = parseLibraryBackup(raw);
                if (!result.ok) {
                    toast(result.error, "error");
                    return;
                }
                setPendingLibrary(result.library);
                return;
            }
            const result = parseBackup(raw);
            if (!result.ok) {
                toast(result.error, "error");
                return;
            }
            setPendingImport(result.data);
        } catch {
            toast(t("无法读取这个 JSON 文件"), "error");
        }
    }

    function handleImport() {
        if (pendingLibrary) {
            useLibraryStore.getState().importLibrary(pendingLibrary);
            const nextLibrary = useLibraryStore.getState();
            useLedgerStore.setState(getActiveBook(nextLibrary));
            toast(t("书库已导入，已切换到备份中的当前账本"), "success");
            setPendingLibrary(null);
            return;
        }
        if (!pendingImport) {
            return;
        }
        const result = importData(pendingImport);
        if (!result.ok) {
            toast(result.error, "error");
            return;
        }
        toast(t("备份已导入，当前账本已被替换"), "success");
        setPendingImport(null);
    }

    return (
        <div>
            <PageHeader
                title={t("设置")}
                description={t("外观、货币和数据管理。所有账目默认只保存在本机浏览器里。")}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <section className="card p-5">
                    <SectionTitle
                        icon={Sun}
                        title={t("外观")}
                        description={t("切换浅色、深色，或跟随系统。")}
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
                        icon={Languages}
                        title={t("界面语言")}
                        description={t("只影响这台设备的界面，不会写入共享账本。")}
                    />
                    <select
                        className="field mt-4"
                        value={language}
                        aria-label={t("界面语言")}
                        onChange={(event) => {
                            const next = event.target.value as Language;
                            if (next === language) {
                                return;
                            }
                            setLanguage(next);
                            window.location.reload();
                        }}
                    >
                        {LANGUAGES.map((item) => (
                            <option key={item.code} value={item.code}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <p className="mt-2 text-[10px] text-muted">
                        {LANGUAGES.find((item) => item.code === language)?.englishName}
                    </p>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={FileJson}
                        title={t("货币")}
                        description={t("账本使用一种货币作为本位币；记账时会自动获取实时汇率，也可以手动修改。")}
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
                    <p className="mt-2 text-[10px] text-muted">{t("记账表单里可以切换外币；应用会先读取缓存，再向公开汇率源请求最新汇率。请求失败时保留手动汇率。")}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted">
                        <span>{t("汇率缓存有效期 30 分钟")}</span>
                        <button
                            type="button"
                            onClick={() => {
                                clearExchangeRateCache();
                                toast(t("汇率缓存已清除"), "success");
                            }}
                            className="font-medium text-accent hover:underline"
                        >{t("清除汇率缓存")}</button>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <input
                            className="field text-xs"
                            value={customCurrency}
                            onChange={(event) => setCustomCurrency(event.target.value)}
                            placeholder={t("自定义代码，如 BTC")}
                            maxLength={3}
                            autoComplete="off"
                        />
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                const code = customCurrency.trim().toUpperCase();
                                if (!/^[A-Z]{3}$/.test(code)) {
                                    toast(t("请输入 3 位货币代码"), "error");
                                    return;
                                }
                                setSettings({ currency: code });
                                setCustomCurrency("");
                                toast(t("本位币已切换为 {0}", [code]), "success");
                            }}
                        >{t("使用")}</Button>
                    </div>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Palette}
                        title={t("个性化")}
                        description={t("自定义 CSS 和键盘快捷键，只影响当前账本。")}
                    />
                    <textarea
                        className="field mt-4 min-h-28 resize-y font-mono text-[11px] leading-relaxed"
                        value={customCss}
                        onChange={(event) => setCustomCss(event.target.value)}
                        maxLength={20_000}
                        placeholder={t(
                            "例如：\n.account-card { border-radius: 18px; }\n:root { --accent: #0f766e; }"
                        )}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-muted">
                            {customCss.length} / 20000
                        </span>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setCustomCss("");
                                    setSettings({ customCss: "" });
                                    toast(t("自定义 CSS 已清空"), "success");
                                }}
                            >{t("清空")}</Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setSettings({ customCss });
                                    toast(t("自定义 CSS 已应用"), "success");
                                }}
                            >{t("应用 CSS")}</Button>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                        <div>
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-text">
                                <Keyboard className="size-3.5 text-muted" />{` ${t("键盘快捷键")}`}</p>
                            <p className="mt-0.5 text-[10px] text-muted">{t("在非输入状态下：N 记一笔，Q 一句话记账")}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                setSettings({
                                    keyboardShortcuts:
                                        settings.keyboardShortcuts === false,
                                })
                            }
                            className={cn(
                                "relative h-5 w-9 shrink-0 rounded-full transition",
                                settings.keyboardShortcuts !== false
                                    ? "bg-accent"
                                    : "bg-surface-3",
                            )}
                            aria-pressed={settings.keyboardShortcuts !== false}
                            aria-label={t("开关键盘快捷键")}
                        >
                            <span
                                className={cn(
                                    "absolute top-0.5 size-4 rounded-full bg-surface transition-all",
                                    settings.keyboardShortcuts !== false
                                        ? "left-[1.125rem]"
                                        : "left-0.5",
                                )}
                            />
                        </button>
                    </div>

                    <div className="mt-4 border-t border-line pt-4">
                        <p className="text-xs font-semibold text-text">{t("iOS 快捷指令 / 自动化")}</p>
                        <code className="mt-2 block break-all rounded-lg border border-line bg-surface-2/60 px-2.5 py-2 text-[10px] text-muted">
                            {quickEntryUrl}
                        </code>
                        <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{`${t("把要记账的文字做 URL 编码后接在最后，打开这个链接会直接进入「一句话记账」。例如：")} `}<code className="ml-1 break-all">
                                {quickEntryUrl}
                                {encodeURIComponent(t("昨天午饭 35 现金"))}
                            </code>
                        </p>
                    </div>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Bot}
                        title={t("AI 助手")}
                        description={t("可选：连接 OpenAI 兼容接口，用 AI 解析一句话记账。密钥只保存在本机。")}
                    />
                    <div className="mt-4 space-y-3">
                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("接口地址")}</span>
                            <input
                                className="field text-xs"
                                value={aiEndpoint}
                                onChange={(event) => setAiEndpoint(event.target.value)}
                                placeholder="https://api.openai.com/v1/chat/completions"
                                autoComplete="off"
                            />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">{t("模型")}</span>
                                <input
                                    className="field text-xs"
                                    value={aiModel}
                                    onChange={(event) => setAiModel(event.target.value)}
                                    placeholder="gpt-4o-mini"
                                    autoComplete="off"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold text-muted">
                                    API Key
                                </span>
                                <input
                                    className="field text-xs"
                                    type="password"
                                    value={aiApiKey}
                                    onChange={(event) => setAiApiKey(event.target.value)}
                                    placeholder="sk-..."
                                    autoComplete="off"
                                />
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                onClick={() => {
                                    const config = {
                                        endpoint: aiEndpoint.trim(),
                                        model: aiModel.trim(),
                                        apiKey: aiApiKey.trim(),
                                    };
                                    ai.setConfig(config);
                                    toast(
                                        isAiConfigured(config)
                                            ? t("AI 配置已保存")
                                            : t("AI 配置已保存，但还不完整"),
                                        "success",
                                    );
                                }}
                            >{t("保存配置")}</Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setAiEndpoint("");
                                    setAiModel("");
                                    setAiApiKey("");
                                    ai.clear();
                                    toast(t("AI 配置已清除"), "success");
                                }}
                            >{t("清除")}</Button>
                            <span className="text-[10px] text-muted">
                                {isAiConfigured(ai)
                                    ? t("已启用 AI 识别")
                                    : t("未启用，使用本地规则识别")}
                            </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-muted">{t(
                            "支持 OpenAI、DeepSeek、Moonshot 等兼容\n                            /chat/completions 的服务。请求从浏览器直接发往你填写的地址，不经过两讫服务器。"
                        )}</p>
                        <Link
                            to="/ai"
                            className="flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                        >{`${t("打开 AI 助手")} `}<ArrowRight className="size-3.5 text-muted" />
                        </Link>
                    </div>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Tags}
                        title={t("分类管理")}
                        description={t("当前有 {0} 个支出分类、{1} 个收入分类。", [
                            categories.filter((category) => category.kind === "expense").length,
                            categories.filter((category) => category.kind === "income").length
                        ])}
                    />
                    <Link
                        to="/categories"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开分类管理")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={UserRound}
                        title={t("当前记账成员")}
                        description={t("作者按当前登录成员记录；成员信息会随账本同步到仓库。同一个私钥可以由多人共用。")}
                    />
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                        <span
                            className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                            style={{ backgroundColor: activeMember?.color ?? "#a8a29e" }}
                        >
                            {activeMember?.name.slice(0, 1) ?? "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-text">
                                {activeMember?.name ?? t("还没有选择成员")}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted">
                                {activeMember
                                    ? t("新流水和账单会记在这个成员名下")
                                    : t("选择成员后才能开始记账")}
                            </p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={openMemberModal}>{t("切换成员")}</Button>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">{t("其他人连接同一个仓库后，也需要选择自己的成员；不能直接修改或删除你记的账。成员列表会同步到仓库，新增成员后所有设备可见。")}</p>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Users}
                        title={t("成员管理")}
                        description={t("当前有 {0} 个成员，用于标记账单和流水归属。", [members.length])}
                    />
                    <Link
                        to="/members"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开成员管理")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Tag}
                        title={t("标签管理")}
                        description={t("当前有 {0} 个标签、{1} 个标签组，用于跨分类标记。", [tags.length, tagGroups.length])}
                    />
                    <Link
                        to="/tags"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开标签管理")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Target}
                        title={t("预算管理")}
                        description={t("当前有 {0} 个预算，按月度或年度跟踪分类支出。", [budgets.length])}
                    />
                    <Link
                        to="/budgets"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开预算管理")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={ChartNoAxesColumn}
                        title={t("分析")}
                        description={t("月度收支、趋势、分类 / 标签 / 成员分布和消费足迹。")}
                    />
                    <Link
                        to="/analytics"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开分析")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Repeat}
                        title={t("周期记账")}
                        description={t("当前有 {0} 条周期规则，启用的会到点自动生成流水。", [recurringRules.length])}
                    />
                    <Link
                        to="/recurring"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开周期记账")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={FileSpreadsheet}
                        title={t("导入账单")}
                        description={t("支持微信、支付宝和银行 CSV，导入前可核对列映射。")}
                    />
                    <Link
                        to="/import"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开 CSV 导入")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={ShieldCheck}
                        title={t("账务规则")}
                        description={t("两讫只做三件事，保证支出不被重复计算。")}
                    />
                    <ul className="mt-4 space-y-2 text-[11px]">
                        <RuleRow label={t("现金消费")} detail={t("资产 ↓ 100 · 支出 ↑ 100")} />
                        <RuleRow label={t("赊账消费")} detail={t("负债 ↑ 100 · 暂不计支出")} />
                        <RuleRow label={t("还款")} detail={t("资产 ↓ 100 · 负债 ↓ 100 · 支出 ↑ 100")} />
                    </ul>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">{t("赊账消费只记负债，还款时再按还款金额计入支出；转账不计收支。")}</p>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={Cloud}
                        title={t("数据源与同步")}
                        description={
                            activeBook.remote
                                ? t("当前账本已连接远程；打开时会优先使用远程数据。")
                                : t("当前账本只保存在本地，可以连接 GitHub、Gitee 或 WebDAV。")
                        }
                    />
                    <Link
                        to="/data"
                        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/55 px-4 py-3 text-xs font-semibold text-text transition hover:border-line-strong"
                    >{`${t("打开数据源")} `}<ArrowRight className="size-3.5 text-muted" />
                    </Link>
                </section>

                <section className="card p-5">
                    <SectionTitle
                        icon={LockKeyhole}
                        title={t("本地密码")}
                        description={
                            authEnabled
                                ? t("已开启。打开两讫时需要输入本地密码。")
                                : t("未设置。设置后打开两讫需要输入密码。")
                        }
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                        {authEnabled ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setPasswordMode("change")}
                                >{t("修改密码")}</Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setPasswordMode("disable")}
                                >{t("关闭密码")}</Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        lock();
                                        toast(t("已锁定"), "success");
                                    }}
                                >
                                    <LockKeyhole className="size-3.5" />{` ${t("立即锁定")}`}</Button>
                            </>
                        ) : (
                            <Button size="sm" onClick={() => setPasswordMode("set")}>
                                <LockKeyhole className="size-3.5" />{` ${t("设置密码")}`}</Button>
                        )}
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">{t(
                        "密码使用 PBKDF2 哈希后保存在本机，仅保护界面访问，不加密 IndexedDB / localStorage 里的账本数据。忘记密码只能清除浏览器数据。"
                    )}</p>
                </section>

                <section className="card p-5 lg:col-span-2">
                    <SectionTitle
                        icon={FileJson}
                        title={t("数据管理")}
                        description={t("数据默认保存在浏览器 IndexedDB；可以导出当前账本或整个书库。")}
                    />
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <button
                            type="button"
                            onClick={handleExportCurrent}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3 text-left transition hover:border-line-strong"
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                                <Download className="size-4" />
                            </span>
                            <span>
                                <span className="block text-xs font-semibold text-text">{t("导出当前账本")}</span>
                                <span className="mt-0.5 block text-[10px] text-muted">{t("单账本 JSON")}</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportLibrary}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3 text-left transition hover:border-line-strong"
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                                <FileJson className="size-4" />
                            </span>
                            <span>
                                <span className="block text-xs font-semibold text-text">{t("导出全部账本")}</span>
                                <span className="mt-0.5 block text-[10px] text-muted">{t("整个书库 JSON")}</span>
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
                                <span className="block text-xs font-semibold text-text">{t("导入备份")}</span>
                                <span className="mt-0.5 block text-[10px] text-muted">{t("自动识别单账本 / 书库")}</span>
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
                                <span className="block text-xs font-semibold text-text">{t("重置当前账本")}</span>
                                <span className="mt-0.5 block text-[10px] text-muted">{t("不影响其他账本")}</span>
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
                        <span>{t("导入单账本会替换当前账本；导入书库会替换全部账本和连接配置。为了安全，书库备份不包含 token 和密码，导入后连接远程时需要重新填写。")}</span>
                    </div>
                </section>

                <section className="card p-5 lg:col-span-2">
                    <SectionTitle
                        icon={ShieldCheck}
                        title={t("关于两讫")}
                        description={t("本地优先的负债记账本。")}
                    />
                    <div className="mt-4 grid gap-3 text-[11px] leading-relaxed text-muted sm:grid-cols-2">
                        <div className="rounded-xl border border-line bg-surface-2/55 p-3.5">
                            <p className="font-semibold text-text">{t("版本")}</p>
                            <p className="mt-1">{t("0.4.0 · 书库格式 v2")}</p>
                        </div>
                        <div className="rounded-xl border border-line bg-surface-2/55 p-3.5">
                            <p className="font-semibold text-text">{t("许可证")}</p>
                            <p className="mt-1">{t("代码以")}{" "}
                                <a
                                    href="https://www.gnu.org/licenses/gpl-3.0.html"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-accent hover:underline"
                                >
                                    GNU GPL-3.0-or-later
                                </a>{" "}{` ${t("发布。")}`}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">{t("两讫是独立实现。功能思路受")}{" "}
                        <a
                            href="https://github.com/glink25/Cent"
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-accent hover:underline"
                        >
                            Cent
                        </a>{" "}{` ${t(
    "启发；Cent 版权归 glink25 所有，采用 CC BY-NC-SA 4.0。本项目未复制 Cent\n                        的源代码、文案或素材。名称「两讫」与双栏 Logo 为原创；界面图标使用\n                        Lucide（ISC）和系统 Emoji。"
)}`}</p>
                </section>
            </div>

            <ConfirmDialog
                open={resetOpen}
                onClose={() => setResetOpen(false)}
                title={t("重置当前账本？")}
                description={t("当前账本的账户、账单、流水和分类都会被清空，并恢复为默认账户和分类。其他账本不受影响。建议先导出备份。")}
                confirmLabel={t("重置当前账本")}
                onConfirm={() => {
                    resetData();
                    toast(t("当前账本已重置"), "success");
                }}
            />

            <ConfirmDialog
                open={pendingImport !== null}
                onClose={() => setPendingImport(null)}
                title={t("导入并替换当前账本？")}
                description={
                    pendingImport
                        ? t("备份包含 {0} 个账户、{1} 张账单、{2} 条流水。当前账本会被完全替换，其他账本不受影响。", [
                        pendingImport.accounts.length,
                        pendingImport.bills.length,
                        pendingImport.entries.length
                    ])
                        : ""
                }
                confirmLabel={t("导入")}
                tone="primary"
                onConfirm={handleImport}
            />

            <ConfirmDialog
                open={pendingLibrary !== null}
                onClose={() => setPendingLibrary(null)}
                title={t("导入并替换整个书库？")}
                description={
                    pendingLibrary
                        ? t(
                        "备份包含 {0} 个账本、{1} 个远程连接。当前书库会被完全替换；token 和密码不会从备份中恢复。",
                        [pendingLibrary.books.length, pendingLibrary.connections.length]
                    )
                        : ""
                }
                confirmLabel={t("导入书库")}
                tone="primary"
                onConfirm={handleImport}
            />

            <PasswordModal
                open={passwordMode !== null}
                mode={passwordMode ?? "set"}
                onClose={() => setPasswordMode(null)}
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
