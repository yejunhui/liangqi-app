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
    { value: "CHF", label: "瑞士法郎 CHF" },
    { value: "NZD", label: "新西兰元 NZD" },
    { value: "MYR", label: "马来西亚林吉特 MYR" },
    { value: "PHP", label: "菲律宾比索 PHP" },
    { value: "VND", label: "越南盾 VND" },
    { value: "IDR", label: "印尼盾 IDR" },
    { value: "INR", label: "印度卢比 INR" },
    { value: "RUB", label: "俄罗斯卢布 RUB" },
    { value: "BRL", label: "巴西雷亚尔 BRL" },
    { value: "TRY", label: "土耳其里拉 TRY" },
    { value: "AED", label: "阿联酋迪拉姆 AED" },
    { value: "SAR", label: "沙特里亚尔 SAR" },
    { value: "SEK", label: "瑞典克朗 SEK" },
    { value: "NOK", label: "挪威克朗 NOK" },
    { value: "DKK", label: "丹麦克朗 DKK" },
    { value: "PLN", label: "波兰兹罗提 PLN" },
    { value: "CZK", label: "捷克克朗 CZK" },
    { value: "MXN", label: "墨西哥比索 MXN" },
    { value: "ZAR", label: "南非兰特 ZAR" },
];
