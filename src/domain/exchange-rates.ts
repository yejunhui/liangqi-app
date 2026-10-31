/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Real-time exchange rates with a local cache and manual fallback.
 * The public feeds are keyless and CORS-friendly.
 */

export interface ExchangeRateQuote {
    base: string;
    quote: string;
    /** Base-currency units per one quote-currency unit. */
    rate: number;
    fetchedAt: number;
    /** True when the live feed failed and a stale cache value was used. */
    stale: boolean;
    source: "live" | "cache";
}

interface CachedRates {
    fetchedAt: number;
    /** base -> quote -> rate (quote units per one base unit). */
    rates: Record<string, number>;
}

type RateCache = Record<string, CachedRates>;

const CACHE_KEY = "liangqi-fx-rates-v1";
const CACHE_TTL = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 4_000;

function readCache(): RateCache {
    if (typeof window === "undefined") {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        if (!raw) {
            return {};
        }
        const value: unknown = JSON.parse(raw);
        if (typeof value !== "object" || value === null) {
            return {};
        }
        return value as RateCache;
    } catch {
        return {};
    }
}

function writeCache(cache: RateCache): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // The latest quote still works for this session.
    }
}

export function rateFromPayload(
    payload: unknown,
    base: string,
    quote: string,
): number | null {
    if (typeof payload !== "object" || payload === null) {
        return null;
    }
    const baseKey = base.toLowerCase();
    const quoteKey = quote.toLowerCase();
    const record = payload as Record<string, unknown>;
    const rates = record[baseKey];
    if (typeof rates === "object" && rates !== null) {
        const value = (rates as Record<string, unknown>)[quoteKey];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            return 1 / value;
        }
    }
    // open.er-api.com shape: { rates: { USD: 7.23 } } and rates are quote per base.
    const directRates = record.rates;
    if (typeof directRates === "object" && directRates !== null) {
        const value = (directRates as Record<string, unknown>)[quote.toUpperCase()];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            return 1 / value;
        }
    }
    return null;
}

async function fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    } finally {
        globalThis.clearTimeout(timer);
    }
}

function normalizeRates(payload: unknown, base: string): Record<string, number> | null {
    if (typeof payload !== "object" || payload === null) {
        return null;
    }
    const baseKey = base.toLowerCase();
    const record = payload as Record<string, unknown>;
    const source = record[baseKey];
    if (typeof source !== "object" || source === null) {
        return null;
    }
    const rates: Record<string, number> = {};
    for (const [key, value] of Object.entries(source)) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            rates[key.toLowerCase()] = value;
        }
    }
    return Object.keys(rates).length > 0 ? rates : null;
}

async function fetchLiveRates(base: string): Promise<CachedRates | null> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return null;
    }
    const code = base.toLowerCase();
    const urls = [
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code}.json`,
        `https://latest.currency-api.pages.dev/v1/currencies/${code}.json`,
        `https://open.er-api.com/v6/latest/${base.toUpperCase()}`,
    ];

    const ratesFromPayload = (payload: unknown): Record<string, number> | null => {
        const normalized = normalizeRates(payload, base);
        if (normalized) {
            return normalized;
        }
        if (typeof payload !== "object" || payload === null) {
            return null;
        }
        const direct = (payload as Record<string, unknown>).rates;
        if (typeof direct !== "object" || direct === null) {
            return null;
        }
        const result: Record<string, number> = {};
        for (const [key, value] of Object.entries(direct)) {
            if (typeof value === "number" && Number.isFinite(value) && value > 0) {
                result[key.toLowerCase()] = value;
            }
        }
        return Object.keys(result).length > 0 ? result : null;
    };

    const tryUrl = async (url: string): Promise<Record<string, number>> => {
        const payload = await fetchJson(url);
        const rates = ratesFromPayload(payload);
        if (!rates) {
            throw new Error("汇率源没有返回数据");
        }
        return rates;
    };

    let rates: Record<string, number> | null = null;
    try {
        rates = await Promise.any(urls.map((url) => tryUrl(url)));
    } catch {
        rates = null;
    }
    if (!rates) {
        return null;
    }

    const cached: CachedRates = { fetchedAt: Date.now(), rates };
    const cache = readCache();
    cache[base] = cached;
    writeCache(cache);
    return cached;
}

export async function getExchangeRate(
    base: string,
    quote: string,
    options: { force?: boolean } = {},
): Promise<ExchangeRateQuote | null> {
    if (base === quote) {
        return {
            base,
            quote,
            rate: 1,
            fetchedAt: Date.now(),
            stale: false,
            source: "cache",
        };
    }
    const cache = readCache();
    const cached = cache[base];
    const cachedValue = cached?.rates[quote.toLowerCase()];
    const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL;

    if (fresh && cachedValue && !options.force) {
        return {
            base,
            quote,
            rate: 1 / cachedValue,
            fetchedAt: cached.fetchedAt,
            stale: false,
            source: "cache",
        };
    }

    const live = await fetchLiveRates(base);
    if (live) {
        const value = live.rates[quote.toLowerCase()];
        if (value && value > 0) {
            return {
                base,
                quote,
                rate: 1 / value,
                fetchedAt: live.fetchedAt,
                stale: false,
                source: "live",
            };
        }
    }

    if (cached && cachedValue && cachedValue > 0) {
        return {
            base,
            quote,
            rate: 1 / cachedValue,
            fetchedAt: cached.fetchedAt,
            stale: true,
            source: "cache",
        };
    }
    return null;
}

export function formatExchangeRate(rate: number): string {
    if (!Number.isFinite(rate) || rate <= 0) {
        return "";
    }
    const value =
        rate >= 100
            ? rate.toFixed(2)
            : rate >= 1
              ? rate.toFixed(4)
              : rate.toPrecision(5);
    return value.replace(/\.?0+$/, "");
}

export function clearExchangeRateCache(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.removeItem(CACHE_KEY);
    } catch {
        // Ignore storage failures.
    }
}
