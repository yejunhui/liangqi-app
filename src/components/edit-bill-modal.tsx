/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Bill } from "@/types";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { TagSelector } from "@/components/tag-selector";
import { AttachmentList } from "@/components/attachment-list";
import { fromDateInputValue, toDateInputValue } from "@/utils/date";
import { useLedgerStore } from "@/store/ledger";
import { toast } from "@/store/toast";

import { t } from "@/i18n";

interface EditBillModalProps {
    bill: Bill | null;
    onClose: () => void;
}

export function EditBillModal({ bill, onClose }: EditBillModalProps) {
    const categories = useLedgerStore((state) => state.categories);
    const members = useLedgerStore((state) => state.members);
    const tagGroups = useLedgerStore((state) => state.tagGroups);
    const tags = useLedgerStore((state) => state.tags);
    const expenseCategories = useMemo(
        () => categories.filter((category) => category.kind === "expense"),
        [categories],
    );
    const updateBill = useLedgerStore((state) => state.updateBill);

    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [memberId, setMemberId] = useState("");
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!bill) {
            return;
        }
        setTitle(bill.title);
        setCategoryId(bill.categoryId ?? "");
        setMemberId(bill.memberId ?? "");
        setTagIds(bill.tagIds ?? []);
        setDueDate(bill.dueDate ? toDateInputValue(bill.dueDate) : "");
        setNote(bill.note ?? "");
        setError("");
    }, [bill]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!bill) {
            return;
        }
        let dueTimestamp: number | undefined;
        if (dueDate) {
            const parsed = fromDateInputValue(dueDate);
            if (parsed === null) {
                setError(t("请选择有效到期日"));
                return;
            }
            dueTimestamp = parsed;
        }
        const result = updateBill(bill.id, {
            title,
            dueDate: dueTimestamp,
            note,
            ...(bill.opening ? {} : { categoryId }),
            memberId,
            tagIds,
        });
        if (!result.ok) {
            setError(result.error);
            return;
        }
        toast(t("账单已更新"), "success");
        onClose();
    }

    return (
        <Modal
            open={bill !== null}
            onClose={onClose}
            title={t("编辑账单")}
            description={t("修改名称、分类或到期日，不影响已产生的流水。")}
            size="sm"
            footer={
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>{t("取消")}</Button>
                    <Button type="submit" form="edit-bill-form" className="flex-1">{t("保存")}</Button>
                </div>
            }
        >
            {bill && (
                <form id="edit-bill-form" className="space-y-4" onSubmit={handleSubmit}>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("账单名称")}</span>
                        <input
                            className="field"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder={t("例如：花呗消费")}
                        />
                    </label>

                    {!bill.opening && (
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-muted">{t("支出分类")}</span>
                            <select
                                className="field"
                                value={categoryId}
                                onChange={(event) => setCategoryId(event.target.value)}
                            >
                                <option value="">{t("未分类")}</option>
                                {expenseCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.emoji} {category.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("成员")}</span>
                        <select
                            className="field"
                            value={memberId}
                            onChange={(event) => setMemberId(event.target.value)}
                        >
                            <option value="">{t("未指定")}</option>
                            {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("到期日")}</span>
                        <input
                            type="date"
                            className="field"
                            value={dueDate}
                            onChange={(event) => setDueDate(event.target.value)}
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-muted">{t("备注")}</span>
                        <textarea
                            className="field min-h-20 resize-none"
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

                    <AttachmentList
                        target={{ kind: "bill", id: bill.id }}
                        attachmentIds={bill.attachmentIds}
                    />

                    {error && (
                        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                            {error}
                        </p>
                    )}
                </form>
            )}
        </Modal>
    );
}
