/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CurrencyOption {
    value: string;
    label: string;
}

export const CURRENCIES: CurrencyOption[] = [
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
