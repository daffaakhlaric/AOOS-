import { describe, expect, it } from "vitest";

import { UnitStatus, parseUnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseUnitStatus", () => {
  it("parses AVAILABLE", () => {
    expect(unwrap(parseUnitStatus("AVAILABLE"))).toBe(UnitStatus.AVAILABLE);
  });

  it("parses RESERVED", () => {
    expect(unwrap(parseUnitStatus("RESERVED"))).toBe(UnitStatus.RESERVED);
  });

  it("parses SOLD", () => {
    expect(unwrap(parseUnitStatus("SOLD"))).toBe(UnitStatus.SOLD);
  });

  it("is case-insensitive and trims", () => {
    expect(unwrap(parseUnitStatus("  sold  "))).toBe(UnitStatus.SOLD);
  });

  it("rejects an unrecognized value", () => {
    const error = unwrapErr(parseUnitStatus("PENDING"));
    expect(error.message).toContain("AVAILABLE");
  });

  it("rejects a non-string value at the type boundary", () => {
    const error = unwrapErr(parseUnitStatus(1 as unknown as string));
    expect(error.message).toContain("must be a string");
  });
});
