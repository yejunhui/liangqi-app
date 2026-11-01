/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type CsvDirection = "expense" | "income";

export interface CsvTable {
    headers: string[];
    rows: string[][];
    delimiter: "," | "\t" | ";";
}

export interface CsvMapping {
    date: number;
    amount: number;
    type: number;
    category: number;
    note: number;
}

export interface CsvTransaction {
    date: number;
    amount: number;
    kind: CsvDirection;
    categoryName?: string;
    note?: string;
    raw: string[];
}

export interface ParsedCsvFile {
    table: CsvTable;
    mapping: CsvMapping;
    transactions: CsvTransaction[];
    skipped: number;
}

const DATE_ALIASES = ["交易时间", "交易日期", "时间", "日期", "time", "date", "记账时间"];
const AMOUNT_ALIASES = ["金额", "交易金额", "金额(元)", "金额（元）", "amount", "money"];
const TYPE_ALIASES = ["收/支", "收支", "类型", "交易类型", "direction", "type"];
const CATEGORY_ALIASES = ["交易分类", "分类", "category", "类别"];
const NOTE_ALIASES = [
    "备注",
    "商品说明",
    "交易对方",
    "说明",
    "description",
    "note",
    "商品",
];

function normalizeHeader(value: string): string {
    return value
        .replace(/^\uFEFF/, "")
        .replace(/\s+/g, "")
        .replace(/[()（）]/g, "")
        .replace(/[:：]/g, "")
        .toLowerCase();
}

function findColumn(headers: string[], aliases: string[]): number {
    const normalized = headers.map(normalizeHeader);
    for (const alias of aliases) {
        const target = normalizeHeader(alias);
        const exact = normalized.findIndex((header) => header === target);
        if (exact !== -1) {
            return exact;
        }
        const partial = normalized.findIndex(
            (header) => header.includes(target) || target.includes(header),
        );
        if (partial !== -1) {
            return partial;
        }
    }
    return -1;
}

function detectDelimiter(text: string): "," | "\t" | ";" {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const candidates = [",", "\t", ";"] as const;
    let best: (typeof candidates)[number] = ",";
    let bestCount = -1;
    for (const candidate of candidates) {
        const count = firstLine.split(candidate).length - 1;
        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    }
    return best;
}

export function parseCsvText(raw: string): CsvTable {
    const text = raw.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(text);
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (quoted) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            quoted = true;
            continue;
        }
        if (char === delimiter) {
            row.push(field);
            field = "";
            continue;
        }
        if (char === "\n" || char === "\r") {
            if (char === "\r" && text[index + 1] === "\n") {
                index += 1;
            }
            row.push(field);
            field = "";
            if (row.some((cell) => cell.trim() !== "")) {
                rows.push(row);
            }
            row = [];
            continue;
        }
        field += char;
    }
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
    }

    let headerIndex = 0;
    for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
        const joined = rows[index].map(normalizeHeader);
        if (
            joined.some((cell) => DATE_ALIASES.some((alias) => cell.includes(normalizeHeader(alias)))) &&
            joined.some((cell) => AMOUNT_ALIASES.some((alias) => cell.includes(normalizeHeader(alias))))
        ) {
            headerIndex = index;
            break;
        }
    }

    const headers = (rows[headerIndex] ?? []).map((header) => header.trim());
    const dataRows = rows
        .slice(headerIndex + 1)
        .map((cells) => cells.map((cell) => cell.trim()))
        .filter((cells) => cells.some((cell) => cell !== ""));

    return { headers, rows: dataRows, delimiter };
}

export function suggestCsvMapping(headers: string[]): CsvMapping {
    return {
        date: findColumn(headers, DATE_ALIASES),
        amount: findColumn(headers, AMOUNT_ALIASES),
        type: findColumn(headers, TYPE_ALIASES),
        category: findColumn(headers, CATEGORY_ALIASES),
        note: findColumn(headers, NOTE_ALIASES),
    };
}

export function parseCsvAmount(value: string): number | null {
    const cleaned = value
        .replace(/[¥￥,，\s元]/g, "")
        .replace(/[()]/g, (match) => (match === "(" ? "-" : ""));
    if (!cleaned) {
        return null;
    }
    const number = Number.parseFloat(cleaned);
    if (!Number.isFinite(number)) {
        return null;
    }
    return Math.round(Math.abs(number) * 100);
}

export function parseCsvDate(value: string): number | null {
    const text = value.trim();
    if (!text) {
        return null;
    }
    const normalized = text.replace(/[./]/g, "-");
    const match = normalized.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
    );
    if (match) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
        ).getTime();
    }
    const compact = normalized.match(/^(\d{4})(\d{2})(\d{2})/);
    if (compact) {
        const [, year, month, day] = compact;
        return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function inferKind(typeValue: string, amountValue: string): CsvDirection | null {
    const type = typeValue.trim();
    if (type.includes("收入") || type.includes("入账") || type === "收") {
        return "income";
    }
    if (type.includes("支出") || type.includes("出账") || type === "支") {
        return "expense";
    }
    if (type.includes("不计") || type.includes("转账") || type.includes("还款")) {
        return null;
    }
    if (amountValue.trim().startsWith("-")) {
        return "expense";
    }
    return "expense";
}

export function parseCsvTransactions(
    table: CsvTable,
    mapping: CsvMapping,
): { transactions: CsvTransaction[]; skipped: number } {
    if (mapping.date < 0 || mapping.amount < 0) {
        return { transactions: [], skipped: table.rows.length };
    }
    const transactions: CsvTransaction[] = [];
    let skipped = 0;
    for (const row of table.rows) {
        const date = parseCsvDate(row[mapping.date] ?? "");
        const amount = parseCsvAmount(row[mapping.amount] ?? "");
        const kind =
            amount === null
                ? null
                : inferKind(
                      mapping.type >= 0 ? (row[mapping.type] ?? "") : "",
                      row[mapping.amount] ?? "",
                  );
        if (date === null || amount === null || amount <= 0 || kind === null) {
            skipped += 1;
            continue;
        }
        transactions.push({
            date,
            amount,
            kind,
            categoryName:
                mapping.category >= 0 ? row[mapping.category]?.trim() || undefined : undefined,
            note:
                mapping.note >= 0
                    ? row[mapping.note]?.trim() || undefined
                    : undefined,
            raw: row,
        });
    }
    return { transactions, skipped };
}

export function parseCsvFile(raw: string): ParsedCsvFile {
    const table = parseCsvText(raw);
    const mapping = suggestCsvMapping(table.headers);
    const { transactions, skipped } = parseCsvTransactions(table, mapping);
    return { table, mapping, transactions, skipped };
}
