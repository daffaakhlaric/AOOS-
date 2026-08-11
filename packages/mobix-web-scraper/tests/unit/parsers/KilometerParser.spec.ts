import { describe, expect, it } from "vitest";

import { KilometerParser } from "../../../src/infrastructure/parsers/KilometerParser.js";

describe("KilometerParser", () => {
  it('parses "45.000 km" (dot-thousands) to 45000', () => {
    const result = KilometerParser.parse("45.000 km");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(45_000);
  });

  it('parses "45 rb km" (rb suffix) to 45000', () => {
    const result = KilometerParser.parse("45 rb km");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(45_000);
  });

  it('parses "45.000" (no unit suffix, still dot-thousands) to 45000', () => {
    const result = KilometerParser.parse("45.000");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(45_000);
  });

  it('parses "45 ribu km" (full "ribu" suffix) to 45000', () => {
    const result = KilometerParser.parse("45 ribu km");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(45_000);
  });

  it('rejects "abc km" (non-numeric, no magnitude suffix)', () => {
    const result = KilometerParser.parse("abc km");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = KilometerParser.parse("");
    expect(result.ok).toBe(false);
  });

  it("rejects a string with no numeric content", () => {
    const result = KilometerParser.parse("km");
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric magnitude-suffixed text", () => {
    const result = KilometerParser.parse("abc rb km");
    expect(result.ok).toBe(false);
  });

  it('parses "12,5 rb km" (comma-decimal + rb suffix) to 12500', () => {
    const result = KilometerParser.parse("12,5 rb km");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(12_500);
  });

  it("rejects a non-string input", () => {
    const result = KilometerParser.parse(undefined as unknown as string);
    expect(result.ok).toBe(false);
  });
});
