/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { Member } from "@/types";
import {
    hasMemberPin,
    hashMemberPin,
    validateMemberPin,
    verifyMemberPin,
} from "@/domain/member-pin";

function member(fields: Partial<Member> = {}): Member {
    return {
        id: "member_1",
        name: "Alice",
        color: "#0f766e",
        createdAt: Date.now(),
        ...fields,
    };
}

describe("member password", () => {
    it("validates password format", () => {
        expect(validateMemberPin("1234")).toBeNull();
        expect(validateMemberPin("abcd")).toBeNull();
        expect(validateMemberPin("family-2026")).toBeNull();
        expect(validateMemberPin("123")).toContain("4");
        expect(validateMemberPin("has space")).not.toBeNull();
        expect(validateMemberPin("x".repeat(33))).not.toBeNull();
    });

    it("hashes and verifies a password", async () => {
        const fields = await hashMemberPin("2468");
        const value = member(fields);
        expect(hasMemberPin(value)).toBe(true);
        await expect(verifyMemberPin("2468", value)).resolves.toBe(true);
        await expect(verifyMemberPin("0000", value)).resolves.toBe(false);
    });

    it("accepts existing 4-digit PINs", async () => {
        const fields = await hashMemberPin("1234");
        const value = member(fields);
        await expect(verifyMemberPin("1234", value)).resolves.toBe(true);
    });

    it("treats members without a password as unlocked", async () => {
        await expect(verifyMemberPin("anything", member())).resolves.toBe(true);
        expect(hasMemberPin(member())).toBe(false);
    });
});
