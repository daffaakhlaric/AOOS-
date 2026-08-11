import { describe, expect, it } from "vitest";

import { ClosingType, parseClosingType } from "../../../src/domain/value-objects/ClosingType.js";
import { unwrapErr } from "../../helpers/result.js";

describe("parseClosingType", () => {
  it("parses TEST_DRIVE, SPK, CANCELLED", () => {
    expect(
      parseClosingType("TEST_DRIVE").ok &&
        (parseClosingType("TEST_DRIVE") as { value: ClosingType }).value,
    ).toBe(ClosingType.TEST_DRIVE);
    expect(parseClosingType("SPK").ok).toBe(true);
    expect(parseClosingType("CANCELLED").ok).toBe(true);
  });

  it("is case-insensitive and trims", () => {
    const result = parseClosingType(" spk ");
    expect(result.ok && result.value).toBe(ClosingType.SPK);
  });

  it("rejects an unknown type", () => {
    const error = unwrapErr(parseClosingType("REFUND"));
    expect(error.message).toContain("REFUND");
  });

  it("rejects a non-string input", () => {
    const error = unwrapErr(parseClosingType(null as unknown as string));
    expect(error.message).toContain("closingType");
  });
});
