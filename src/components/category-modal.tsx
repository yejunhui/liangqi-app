/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Category, CategoryKind } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";
import { cn } from "@/utils/cn";

import { t } from "@/i18n";

const COLORS = [
    "#e07a5f",
    "#f2b84b",
    "#10b981",
    "#14b8a6",
    "#3d8bfd",
    "#60a5fa",
    "#c084fc",
    "#fb7185",
    "#f59e0b",
    "#a8a29e",
];

const EMOJIS = [
    "🍜",
    "☕",
    "🚇",
    "🚕",
    "🛍️",
    "🏠",
    "🎮",
    "💊",
    "📚",
    "💰",
    "🎁",
    "📈",
    "✨",
    "📦",
    "🧾",
    "🐱",
];

interface CategoryModalProps {
    open: boolean;
    category: Category | null;
    defaultKind: CategoryKind;
    onClose: () => void;
}

export function CategoryModal({
    open,
    category,
    defaultKind,
    onClose,
}: CategoryModalProps) {
    const addCategory = useLedgerStore((state) => state.addCategory);
    const updateCategory = useLedgerStore((state) => state.updateCategory);
    const categories = useLedgerStore((state) => state.categories);

    const [name, setName] = useState("");
    const [kind, setKind] = useState<CategoryKind>("expense");
    const [emoji, setEmoji] = useState("🍜");
    const [color, setColor] = useState(COLORS[0]);
    const [parent, setParent] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }
        if (category) {
            setName(category.name);
            setKind(category.kind);
            setEmoji(category.emoji);
            setColor(category.color);
            setParent(category.parent ?? "");
        } else {
            setName("");
            setKind(defaultKind);
            setEmoji(defaultKind === "income" ? "💰" : "🍜");
            setColor(defaultKind === "income" ? COLORS[2] : COLORS[0]);
            setParent("");
        }
        setError("");
    }, [open, category, defaultKind]);

    const editing = category !== null;
    const hasChildren =
        category !== null && categories.some((item) => item.parent === category.id);
    const parentOptions = categories.filter(
        (item) =>
            item.kind === kind &&
            !item.parent &&
            (!category || (item.id !== category.id && !hasChildren)),
    );

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (editing) {
            const result = updateCategory(category.id, { name, emoji, color, parent });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            toast(t("分类已更新"), "success");
            onClose();
            return;
        }

        const result = addCategory({ name, kind, emoji, color, parent });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(t("分类已创建"), "success");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? t("编辑分类") : t("添加分类")}
            description={t("分类只影响统计展示，不会改变账户余额或账单金额。")}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="category-form" className="flex-1">
                        {editing ? t("保存") : t("创建分类")}
                    </Button>
                </div>
            }
        >
            <form id="category-form" className="space-y-4" onSubmit={handleSubmit}>
                {!editing && (
                    <div>
                        <p className="mb-2 text-xs font-semibold text-muted">{t("分类类型")}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(
                                [
                                    { value: "expense", label: t("支出分类"), hint: t("餐饮、交通等") },
                                    { value: "income", label: t("收入分类"), hint: t("工资、奖金等") },
                                ] as const
                            ).map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setKind(option.value);
                                        setEmoji(option.value === "income" ? "💰" : "🍜");
                                        setParent("");
                                    }}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition",
                                        kind === option.value
                                            ? "border-accent bg-accent-soft/70"
                                            : "border-line bg-surface hover:border-line-strong",
                                    )}
                                >
                                    <span className="block text-xs font-semibold text-text">
                                        {option.label}
                                    </span>
                                    <span className="mt-0.5 block text-[10px] text-muted">
                                        {option.hint}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("名称")}</span>
                    <input
                        className="field"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={kind === "income" ? t("例如：工资") : t("例如：餐饮")}
                        autoFocus
                    />
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">{t("父分类（可选）")}</span>
                    <select
                        className="field"
                        value={parent}
                        onChange={(event) => setParent(event.target.value)}
                        disabled={hasChildren}
                    >
                        <option value="">{t("作为一级分类")}</option>
                        {parentOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.emoji} {item.name}
                            </option>
                        ))}
                    </select>
                    <span className="mt-1.5 block text-[10px] leading-relaxed text-muted">
                        {hasChildren
                            ? t("这个分类下已有子分类，不能再设为其他分类的子分类。")
                            : t("支持两级分类，例如「餐饮 / 午餐」。")}
                    </span>
                </label>

                <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">{t("图标")}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {EMOJIS.map((item) => (
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

                <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">{t("颜色")}</p>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setColor(item)}
                                className={cn(
                                    "size-7 rounded-full border-2 transition",
                                    color === item
                                        ? "border-text scale-110"
                                        : "border-transparent hover:scale-105",
                                )}
                                style={{ backgroundColor: item }}
                                aria-label={t("选择颜色 {0}", [item])}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/55 p-3">
                    <span
                        className="grid size-10 place-items-center rounded-full text-lg"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        {emoji || "📦"}
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-text">
                            {parent
                                ? `${parentOptions.find((item) => item.id === parent)?.name ?? ""} / `
                                : ""}
                            {name || t("分类预览")}
                        </p>
                        <p className="text-[10px] text-muted">
                            {kind === "income" ? t("收入分类") : t("支出分类")}
                            {parent ? t(" · 二级分类") : ""}
                        </p>
                    </div>
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
