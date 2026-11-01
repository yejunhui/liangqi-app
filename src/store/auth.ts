/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";

import { t } from "@/i18n";

const AUTH_KEY = "liangqi-auth-v1";
const SESSION_KEY = "liangqi-unlocked-v1";
const ITERATIONS = 210_000;
const MIN_PASSWORD_LENGTH = 6;

interface StoredAuth {
    version: 1;
    salt: string;
    hash: string;
    iterations: number;
    createdAt: number;
}

interface AuthState {
    enabled: boolean;
    unlocked: boolean;
    setPassword: (password: string) => Promise<void>;
    changePassword: (current: string, next: string) => Promise<void>;
    verifyPassword: (password: string) => Promise<boolean>;
    unlock: (password: string) => Promise<boolean>;
    lock: () => void;
    disable: () => void;
}

function readStoredAuth(): StoredAuth | null {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(AUTH_KEY);
        if (!raw) {
            return null;
        }
        const value: unknown = JSON.parse(raw);
        if (
            typeof value !== "object" ||
            value === null ||
            (value as StoredAuth).version !== 1 ||
            typeof (value as StoredAuth).salt !== "string" ||
            typeof (value as StoredAuth).hash !== "string" ||
            typeof (value as StoredAuth).iterations !== "number"
        ) {
            return null;
        }
        return value as StoredAuth;
    } catch {
        return null;
    }
}

function writeStoredAuth(value: StoredAuth | null): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        if (value) {
            window.localStorage.setItem(AUTH_KEY, JSON.stringify(value));
        } else {
            window.localStorage.removeItem(AUTH_KEY);
        }
    } catch {
        // Storage can be unavailable; the lock still works for this tab.
    }
}

function readSessionUnlocked(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
        return false;
    }
}

function writeSessionUnlocked(value: boolean): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        if (value) {
            window.sessionStorage.setItem(SESSION_KEY, "1");
        } else {
            window.sessionStorage.removeItem(SESSION_KEY);
        }
    } catch {
        // Ignore storage failures.
    }
}

async function deriveHash(
    password: string,
    salt: Uint8Array,
    iterations: number,
): Promise<string> {
    if (!globalThis.crypto?.subtle) {
        throw new Error(t("当前环境不支持 Web Crypto，请使用 HTTPS 或 localhost"));
    }
    const key = await globalThis.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt as unknown as BufferSource,
            iterations,
            hash: "SHA-256",
        },
        key,
        256,
    );
    return bytesToBase64(new Uint8Array(bits));
}

function randomSalt(): Uint8Array {
    const salt = new Uint8Array(16);
    globalThis.crypto.getRandomValues(salt);
    return salt;
}

function equalHash(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}

async function verifyStoredPassword(password: string): Promise<boolean> {
    const value = readStoredAuth();
    if (!value) {
        return false;
    }
    try {
        const hash = await deriveHash(
            password,
            base64ToBytes(value.salt),
            value.iterations,
        );
        return equalHash(hash, value.hash);
    } catch {
        return false;
    }
}

const stored = readStoredAuth();
const initialEnabled = stored !== null;
const initialUnlocked = !initialEnabled || readSessionUnlocked();

export const useAuthStore = create<AuthState>()((set) => ({
    enabled: initialEnabled,
    unlocked: initialUnlocked,

    async setPassword(password) {
        if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(t("密码至少需要 {0} 位", [MIN_PASSWORD_LENGTH]));
        }
        const salt = randomSalt();
        const hash = await deriveHash(password, salt, ITERATIONS);
        writeStoredAuth({
            version: 1,
            salt: bytesToBase64(salt),
            hash,
            iterations: ITERATIONS,
            createdAt: Date.now(),
        });
        writeSessionUnlocked(true);
        set({ enabled: true, unlocked: true });
    },

    async changePassword(current, next) {
        const valid = await verifyStoredPassword(current);
        if (!valid) {
            throw new Error(t("当前密码不正确"));
        }
        await useAuthStore.getState().setPassword(next);
    },

    async verifyPassword(password) {
        return verifyStoredPassword(password);
    },

    async unlock(password) {
        const valid = await verifyStoredPassword(password);
        if (!valid) {
            return false;
        }
        writeSessionUnlocked(true);
        set({ enabled: true, unlocked: true });
        return true;
    },

    lock() {
        writeSessionUnlocked(false);
        set({ unlocked: false });
    },

    disable() {
        writeStoredAuth(null);
        writeSessionUnlocked(false);
        set({ enabled: false, unlocked: true });
    },
}));
