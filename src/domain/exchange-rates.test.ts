/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
    formatExchangeRate,
    getExchangeRate,
    rateFromPayload,
} from "@/domain/exchange-rates";

const PAYLOAD = {
    date: "2026-10-31",
    cny: {
        usd: 0.14,
        jpy: 20,
        eur: 0.13,
    },
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("exchange rates", () => {
    it("extracts a rate from the currency-api payload", () => {
        expect(rateFromPayload(PAYLOAD, "CNY", "USD")).toBeCloseTo(1 / 0.14, 8);
        expect(rateFromPayload(PAYLOAD, "CNY", "JPY")).toBeCloseTo(0.05, 8);
        expect(rateFromPayload(PAYLOAD, "CNY", "GBP")).toBeNull();
    });

    it("extracts direct rates from open.er-api", () => {
        expect(
            rateFromPayload({ rates: { USD: 7.2 } }, "CNY", "USD"),
        ).toBeCloseTo(1 / 7.2, 8);
    });

    it("uses the live feed", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(JSON.stringify(PAYLOAD), { status: 200 }),
            ),
        );
        const quote = await getExchangeRate("CNY", "USD");
        expect(quote?.rate).toBeCloseTo(1 / 0.14, 8);
        expect(quote?.stale).toBe(false);
        expect(quote?.source).toBe("live");
    });

    it("returns 1 for identical currencies", async () => {
        const quote = await getExchangeRate("CNY", "CNY");
        expect(quote?.rate).toBe(1);
    });

    it("returns null when every feed fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("nope", { status: 500 })),
        );
        expect(await getExchangeRate("CNY", "USD")).toBeNull();
    });

    it("formats rates without trailing zeros", () => {
        expect(formatExchangeRate(7.142857)).toBe("7.1429");
        expect(formatExchangeRate(100)).toBe("100");
        expect(formatExchangeRate(0.0000123456)).toBe("0.000012346");
    });
});
