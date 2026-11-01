/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Member } from "@/types";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 32;
const PIN_ITERATIONS = 160_000;

export interface MemberPinFields {
    pinHash: string;
    pinSalt: string;
    pinIterations: number;
}

export function hasMemberPin(member: Member): boolean {
    return Boolean(member.pinHash && member.pinSalt && member.pinIterations);
}

export function validateMemberPin(pin: string): string | null {
    if (!/^\S{4,32}$/.test(pin)) {
        return `密码需要 ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} 位，不能包含空格`;
    }
    return null;
}

async function derivePinHash(
    pin: string,
    salt: Uint8Array,
    iterations: number,
): Promise<string> {
    if (!globalThis.crypto?.subtle) {
        throw new Error("当前环境不支持 Web Crypto，请使用 HTTPS 或 localhost");
    }
    const key = await globalThis.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(pin),
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

export async function hashMemberPin(pin: string): Promise<MemberPinFields> {
    const invalid = validateMemberPin(pin);
    if (invalid) {
        throw new Error(invalid);
    }
    const salt = new Uint8Array(16);
    globalThis.crypto.getRandomValues(salt);
    const pinHash = await derivePinHash(pin, salt, PIN_ITERATIONS);
    return {
        pinHash,
        pinSalt: bytesToBase64(salt),
        pinIterations: PIN_ITERATIONS,
    };
}

export async function verifyMemberPin(pin: string, member: Member): Promise<boolean> {
    if (!hasMemberPin(member)) {
        return true;
    }
    try {
        const hash = await derivePinHash(
            pin,
            base64ToBytes(member.pinSalt!),
            member.pinIterations!,
        );
        if (hash.length !== member.pinHash!.length) {
            return false;
        }
        let mismatch = 0;
        for (let index = 0; index < hash.length; index += 1) {
            mismatch |= hash.charCodeAt(index) ^ member.pinHash!.charCodeAt(index);
        }
        return mismatch === 0;
    } catch {
        return false;
    }
}
