import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashPhoneForAudience, normalizePhoneForAudience } from "../../../src/utils/PhoneHasher.js";

describe("PhoneHasher (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
  it("normalizePhoneForAudience strips a leading + and any non-digit characters", () => {
    expect(normalizePhoneForAudience("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("normalizePhoneForAudience returns an empty string for input with no digits", () => {
    expect(normalizePhoneForAudience("abc")).toBe("");
  });

  it("hashPhoneForAudience SHA256-hashes the normalized digits, matching a manual computation", () => {
    const expected = createHash("sha256").update("6281234567890").digest("hex");
    expect(hashPhoneForAudience("+6281234567890")).toBe(expected);
  });

  it("hashPhoneForAudience is deterministic and equivalent-input-insensitive to formatting", () => {
    expect(hashPhoneForAudience("+62 812-3456-7890")).toBe(hashPhoneForAudience("6281234567890"));
  });
});
