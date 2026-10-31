/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Modal } from "@/components/modal";
import { Button } from "@/components/button";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "danger" | "primary";
    onConfirm: () => void;
    onClose: () => void;
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "确认",
    cancelLabel = "取消",
    tone = "danger",
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={tone === "danger" ? "danger" : "primary"}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            }
        >
            <p className="text-sm leading-relaxed text-muted">
                这个操作会直接修改本地账本数据，确认后无法撤销。
            </p>
        </Modal>
    );
}
