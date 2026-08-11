import { describe, expect, it } from "vitest";

import {
  UnitTransmission,
  parseUnitTransmission,
} from "../../../src/domain/value-objects/UnitTransmission.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseUnitTransmission", () => {
  it("parses 'AT'", () => {
    expect(unwrap(parseUnitTransmission("AT"))).toBe(UnitTransmission.AT);
  });

  it("parses 'MT'", () => {
    expect(unwrap(parseUnitTransmission("MT"))).toBe(UnitTransmission.MT);
  });

  it("is case-insensitive", () => {
    expect(unwrap(parseUnitTransmission("at"))).toBe(UnitTransmission.AT);
  });

  it("trims surrounding whitespace", () => {
    expect(unwrap(parseUnitTransmission("  MT  "))).toBe(UnitTransmission.MT);
  });

  it("rejects an unrecognized value", () => {
    const error = unwrapErr(parseUnitTransmission("CVT"));
    expect(error.message).toContain('"AT" or "MT"');
  });

  it("rejects a non-string value at the type boundary", () => {
    const error = unwrapErr(parseUnitTransmission(42 as unknown as string));
    expect(error.message).toContain("must be a string");
  });
});
