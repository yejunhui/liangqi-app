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

describe("member PIN", () => {
    it("validates PIN format", () => {
        expect(validateMemberPin("1234")).toBeNull();
        expect(validateMemberPin("123")).toContain("4");
        expect(validateMemberPin("abcd")).not.toBeNull();
    });

    it("hashes and verifies a PIN", async () => {
        const fields = await hashMemberPin("2468");
        const value = member(fields);
        expect(hasMemberPin(value)).toBe(true);
        await expect(verifyMemberPin("2468", value)).resolves.toBe(true);
        await expect(verifyMemberPin("0000", value)).resolves.toBe(false);
    });

    it("treats members without a PIN as unlocked", async () => {
        await expect(verifyMemberPin("anything", member())).resolves.toBe(true);
        expect(hasMemberPin(member())).toBe(false);
    });
});
