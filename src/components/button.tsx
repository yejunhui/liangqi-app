/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
}

const variants: Record<Variant, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    danger: "btn-danger",
};

const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
};

export function Button({
    variant = "primary",
    size = "md",
    className,
    children,
    type = "button",
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cn("btn", variants[variant], sizes[size], className)}
            {...props}
        >
            {children}
        </button>
    );
}
