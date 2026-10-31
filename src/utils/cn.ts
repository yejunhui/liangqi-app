/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
    return clsx(inputs);
}
