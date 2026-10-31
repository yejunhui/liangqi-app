/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { parseRepositoryInput } from "@/remote/repo-owner";

describe("repository input", () => {
    it("accepts a bare repo name", () => {
        expect(parseRepositoryInput("family-ledger")).toEqual({
            repo: "family-ledger",
        });
    });

    it("accepts owner/repo and git suffixes", () => {
        expect(parseRepositoryInput("alice/family-ledger")).toEqual({
            owner: "alice",
            repo: "family-ledger",
        });
        expect(parseRepositoryInput("alice/family-ledger.git")).toEqual({
            owner: "alice",
            repo: "family-ledger",
        });
    });

    it("accepts repository URLs", () => {
        expect(
            parseRepositoryInput("https://github.com/alice/family-ledger.git"),
        ).toEqual({ owner: "alice", repo: "family-ledger" });
        expect(
            parseRepositoryInput("https://gitee.com/alice/family-ledger"),
        ).toEqual({ owner: "alice", repo: "family-ledger" });
    });

    it("handles empty input", () => {
        expect(parseRepositoryInput("   ")).toEqual({ repo: "" });
    });
});
