/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@/i18n";

export interface CurrencyOption {
    value: string;
    label: string;
}

export const CURRENCIES: CurrencyOption[] = [
    { value: "CNY", label: t("人民币 CNY") },
    { value: "USD", label: t("美元 USD") },
    { value: "EUR", label: t("欧元 EUR") },
    { value: "JPY", label: t("日元 JPY") },
    { value: "GBP", label: t("英镑 GBP") },
    { value: "HKD", label: t("港币 HKD") },
    { value: "TWD", label: t("新台币 TWD") },
    { value: "KRW", label: t("韩元 KRW") },
    { value: "THB", label: t("泰铢 THB") },
    { value: "SGD", label: t("新加坡元 SGD") },
    { value: "AUD", label: t("澳元 AUD") },
    { value: "CAD", label: t("加元 CAD") },
    { value: "CHF", label: t("瑞士法郎 CHF") },
    { value: "NZD", label: t("新西兰元 NZD") },
    { value: "MYR", label: t("马来西亚林吉特 MYR") },
    { value: "PHP", label: t("菲律宾比索 PHP") },
    { value: "VND", label: t("越南盾 VND") },
    { value: "IDR", label: t("印尼盾 IDR") },
    { value: "INR", label: t("印度卢比 INR") },
    { value: "RUB", label: t("俄罗斯卢布 RUB") },
    { value: "BRL", label: t("巴西雷亚尔 BRL") },
    { value: "TRY", label: t("土耳其里拉 TRY") },
    { value: "AED", label: t("阿联酋迪拉姆 AED") },
    { value: "SAR", label: t("沙特里亚尔 SAR") },
    { value: "SEK", label: t("瑞典克朗 SEK") },
    { value: "NOK", label: t("挪威克朗 NOK") },
    { value: "DKK", label: t("丹麦克朗 DKK") },
    { value: "PLN", label: t("波兰兹罗提 PLN") },
    { value: "CZK", label: t("捷克克朗 CZK") },
    { value: "MXN", label: t("墨西哥比索 MXN") },
    { value: "ZAR", label: t("南非兰特 ZAR") },
];
