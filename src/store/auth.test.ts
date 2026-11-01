/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
    private data = new Map<string, string>();

    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }

    removeItem(key: string): void {
        this.data.delete(key);
    }

    clear(): void {
        this.data.clear();
    }

    key(index: number): string | null {
        return [...this.data.keys()][index] ?? null;
    }

    get length(): number {
        return this.data.size;
    }
}

beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
        localStorage: new MemoryStorage(),
        sessionStorage: new MemoryStorage(),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("local password", () => {
    it("sets, locks, unlocks and disables a local password", async () => {
        const { useAuthStore } = await import("@/store/auth");
        await useAuthStore.getState().setPassword("secret-123");
        expect(useAuthStore.getState().enabled).toBe(true);
        expect(useAuthStore.getState().unlocked).toBe(true);

        useAuthStore.getState().lock();
        expect(useAuthStore.getState().unlocked).toBe(false);
        await expect(useAuthStore.getState().unlock("wrong")).resolves.toBe(false);
        await expect(useAuthStore.getState().unlock("secret-123")).resolves.toBe(true);
        expect(useAuthStore.getState().unlocked).toBe(true);

        await useAuthStore.getState().changePassword("secret-123", "new-secret");
        useAuthStore.getState().lock();
        await expect(useAuthStore.getState().unlock("secret-123")).resolves.toBe(false);
        await expect(useAuthStore.getState().unlock("new-secret")).resolves.toBe(true);

        useAuthStore.getState().disable();
        expect(useAuthStore.getState().enabled).toBe(false);
        expect(useAuthStore.getState().unlocked).toBe(true);
    });

    it("rejects short passwords", async () => {
        const { useAuthStore } = await import("@/store/auth");
        await expect(useAuthStore.getState().setPassword("123")).rejects.toThrow(
            /password|密码/i,
        );
    });
});
