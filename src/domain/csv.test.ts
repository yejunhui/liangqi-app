/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
    parseCsvFile,
    parseCsvAmount,
    parseCsvDate,
    parseCsvTransactions,
    parseCsvText,
    suggestCsvMapping,
} from "@/domain/csv";

const WECHAT = `\uFEFF微信支付账单明细
微信昵称：[我]
起始时间：[2026-10-01 00:00:00] 终止时间：[2026-10-31 23:59:59]

交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-10-01 08:30:00,商户消费,早餐店,豆浆油条,支出,¥12.00,零钱,支付成功,1001,2001,
2026-10-02 12:00:00,商户消费,公司,工资,收入,¥8000.00,银行卡,已入账,1002,2002,十月工资
2026-10-03 18:20:00,转账,朋友,还款,不计收支,¥200.00,零钱,已收钱,1003,2003,
`;

describe("csv import", () => {
    it("parses quoted CSV with BOM and a preamble", () => {
        const table = parseCsvText(WECHAT);
        expect(table.headers[0]).toBe("交易时间");
        expect(table.rows).toHaveLength(3);
        expect(table.rows[0][5]).toBe("¥12.00");
        expect(table.rows[2][3]).toContain("还款");
    });

    it("auto-detects Chinese bank / WeChat columns", () => {
        const table = parseCsvText(WECHAT);
        const mapping = suggestCsvMapping(table.headers);
        expect(mapping.date).toBe(0);
        expect(mapping.amount).toBe(5);
        expect(mapping.type).toBe(4);
        expect(mapping.note).toBe(10);

        const { transactions, skipped } = parseCsvTransactions(table, mapping);
        expect(skipped).toBe(1);
        expect(transactions).toHaveLength(2);
        expect(transactions[0]).toMatchObject({
            amount: 1200,
            kind: "expense",
        });
        expect(transactions[1]).toMatchObject({
            amount: 800_000,
            kind: "income",
            note: "十月工资",
        });
    });

    it("parses quoted commas and escaped quotes", () => {
        const table = parseCsvText(
            '日期,金额,收/支,备注\n2026-10-01,12.50,支出,"早餐, 豆浆"\n2026-10-02,20,收入,"他说""好"""\n',
        );
        expect(table.rows[0][3]).toBe("早餐, 豆浆");
        expect(table.rows[1][3]).toBe('他说"好"');
    });

    it("parses amount and date formats", () => {
        expect(parseCsvAmount("¥1,234.56")).toBe(123_456);
        expect(parseCsvAmount("(35.00)")).toBe(3500);
        expect(parseCsvAmount("abc")).toBeNull();
        expect(parseCsvDate("2026/10/31 08:05:00")).toBe(
            new Date(2026, 9, 31, 8, 5, 0).getTime(),
        );
        expect(parseCsvDate("20261031")).toBe(new Date(2026, 9, 31).getTime());
    });

    it("auto-parses a whole file", () => {
        const parsed = parseCsvFile(WECHAT);
        expect(parsed.transactions).toHaveLength(2);
        expect(parsed.skipped).toBe(1);
        expect(parsed.mapping.type).toBe(4);
    });
});
