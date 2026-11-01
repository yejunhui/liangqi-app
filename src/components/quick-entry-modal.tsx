/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, Mic, MicOff, Sparkles } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { formatCents } from "@/domain/money";
import type { QuickEntrySuggestion } from "@/domain/quick-entry";
import { describeQuickEntry, parseQuickEntry } from "@/domain/quick-entry";
import { parseQuickEntryWithAi } from "@/domain/ai";
import { formatDateFull } from "@/utils/date";
import { useCurrency, useLedgerStore } from "@/store/ledger";
import { isAiConfigured, useAiStore } from "@/store/ai";
import { useUIStore } from "@/store/ui";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { getLanguage, t } from "@/i18n";

interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: unknown) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
    if (typeof window === "undefined") {
        return null;
    }
    const scope = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Ctor) {
        return null;
    }
    const recognition = new Ctor();
    recognition.lang = getLanguage();
    recognition.continuous = false;
    recognition.interimResults = true;
    return recognition;
}

export function QuickEntryModal() {
    const open = useUIStore((state) => state.quickEntryOpen);
    const seed = useUIStore((state) => state.quickEntrySeed);
    const close = useUIStore((state) => state.closeQuickEntry);
    const openEntryModal = useUIStore((state) => state.openEntryModal);
    const categories = useLedgerStore((state) => state.categories);
    const accounts = useLedgerStore((state) => state.accounts);
    const currency = useCurrency();
    const ai = useAiStore();
    const aiReady = isAiConfigured(ai);

    const [text, setText] = useState("");
    const [listening, setListening] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<QuickEntrySuggestion | null>(
        null,
    );
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        setText(seed ?? "");
        setAiSuggestion(null);
        setAiError("");
        setListening(false);
    }, [open, seed]);

    const parsed = useMemo(
        () => parseQuickEntry({ text, categories, accounts }),
        [text, categories, accounts],
    );
    const suggestion = aiSuggestion ?? parsed.suggestion;

    function updateText(value: string) {
        setText(value);
        setAiSuggestion(null);
        setAiError("");
    }

    async function runAi() {
        if (!aiReady || !text.trim()) {
            return;
        }
        setAiLoading(true);
        setAiError("");
        try {
            const result = await parseQuickEntryWithAi({
                text,
                categories,
                accounts,
                config: ai,
            });
            setAiSuggestion(result);
        } catch (error) {
            setAiError(error instanceof Error ? error.message : t("AI 识别失败"));
        } finally {
            setAiLoading(false);
        }
    }

    function startVoice() {
        const recognition = getRecognition();
        if (!recognition) {
            toast(t("这个浏览器不支持语音识别，可以直接输入文字"), "info");
            return;
        }
        setListening(true);
        recognition.onresult = (event: unknown) => {
            const result = event as {
                results: ArrayLike<ArrayLike<{ transcript: string }>>;
            };
            const transcript = Array.from(result.results)
                .map((item) => item[0]?.transcript ?? "")
                .join("");
            if (transcript) {
                updateText(transcript);
            }
        };
        recognition.onerror = () => {
            setListening(false);
            toast(t("没有听清，再试一次或者输入文字"), "info");
        };
        recognition.onend = () => setListening(false);
        try {
            recognition.start();
        } catch {
            setListening(false);
        }
    }

    function handleContinue() {
        if (!suggestion) {
            return;
        }
        close();
        openEntryModal({
            kind: suggestion.kind,
            paymentMode: suggestion.paymentMode,
            prefill: {
                amount: suggestion.amount,
                date: suggestion.date,
                categoryId: suggestion.categoryId,
                assetAccountId: suggestion.accountId,
                liabilityAccountId: suggestion.liabilityAccountId,
                note: suggestion.note,
            },
        });
    }

    return (
        <Modal
            open={open}
            onClose={close}
            title={t("一句话记账")}
            description={t("说一句或打一句，自动识别金额、分类、账户和日期。")}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={close}>{t("取消")}</Button>
                    <Button
                        className="flex-1"
                        onClick={handleContinue}
                        disabled={!suggestion}
                    >
                        <Sparkles className="size-3.5" />{` ${t("继续记账")}`}</Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="relative">
                    <textarea
                        className="field min-h-28 resize-none pr-12 text-sm"
                        value={text}
                        onChange={(event) => updateText(event.target.value)}
                        placeholder={t("例如：信用卡 打车 28.5，或 借呗 午饭 35")}
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={startVoice}
                        className={cn(
                            "absolute right-2 top-2 grid size-9 place-items-center rounded-xl border transition",
                            listening
                                ? "border-danger/30 bg-danger-soft text-danger"
                                : "border-line bg-surface text-muted hover:text-text",
                        )}
                        aria-label={listening ? t("正在听") : t("语音输入")}
                    >
                        {listening ? (
                            <MicOff className="size-4" />
                        ) : (
                            <Mic className="size-4" />
                        )}
                    </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {[
                        t("昨天午饭 35 现金"),
                        t("工资 8000 银行卡"),
                        t("信用卡 打车 28.5"),
                    ].map((example) => (
                        <button
                            key={example}
                            type="button"
                            onClick={() => updateText(example)}
                            className="rounded-lg border border-line bg-surface-2/50 px-2 py-1 text-[10px] text-muted transition hover:text-text"
                        >
                            {example}
                        </button>
                    ))}
                    {aiReady && (
                        <button
                            type="button"
                            onClick={() => void runAi()}
                            disabled={aiLoading || !text.trim()}
                            className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent-soft/60 px-2 py-1 text-[10px] font-semibold text-accent transition hover:bg-accent-soft disabled:opacity-50"
                        >
                            <Sparkles className="size-3" />
                            {aiLoading ? t("AI 识别中…") : t("AI 识别")}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (!navigator.clipboard?.readText) {
                                toast(t("这个浏览器不支持读取剪贴板"), "info");
                                return;
                            }
                            void navigator.clipboard
                                .readText()
                                .then((value) => {
                                    if (value.trim()) {
                                        updateText(value.trim());
                                    }
                                })
                                .catch(() =>
                                    toast(t("没有读取到剪贴板内容"), "info"),
                                );
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2 py-1 text-[10px] text-muted transition hover:text-text"
                    >
                        <ClipboardPaste className="size-3" />{` ${t("粘贴")}`}</button>
                </div>

                {aiError && (
                    <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[10px] leading-relaxed text-danger">
                        {aiError}
                    </p>
                )}

                {suggestion ? (
                    <div className="rounded-2xl border border-accent/25 bg-accent-soft/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-medium text-muted">
                                    {suggestion.kind === "income"
                                        ? t("收入")
                                        : suggestion.paymentMode === "liability"
                                          ? t("赊账（只记负债）")
                                          : t("现金支出")}
                                </p>
                                <p className="mt-0.5 text-2xl font-bold tabular-nums text-text">
                                    {formatCents(suggestion.amount, currency)}
                                </p>
                            </div>
                            <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-accent">
                                {aiSuggestion ? "AI · " : ""}
                                {formatDateFull(suggestion.date)}
                            </span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted">
                            {describeQuickEntry(suggestion, categories, accounts)}
                        </p>
                    </div>
                ) : (
                    <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-3 text-[11px] leading-relaxed text-muted">
                        {text.trim()
                            ? parsed.error
                            : t("支持：金额、分类名、账户名、昨天 / 前天、收入 / 工资、信用卡 / 花呗 / 借呗等负债账户。")}                    </p>
                )}

                <p className="text-[10px] leading-relaxed text-muted">{t(
                    "语音使用浏览器自带的 Web Speech\n                    识别，不会上传到两讫的服务器；识别后仍会打开记账表单让你确认。"
                )}</p>
            </div>
        </Modal>
    );
}
