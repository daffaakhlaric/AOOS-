import { describe, expect, it } from "vitest";

import { PriceParser } from "../../../src/infrastructure/parsers/PriceParser.js";

describe("PriceParser", () => {
  it('parses "Rp 165.000.000" (dot-thousands) to 165000000', () => {
    const result = PriceParser.parse("Rp 165.000.000");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(165_000_000);
  });

  it('parses "Rp 1,5 Miliar" (comma-decimal + Miliar suffix) to 1500000000', () => {
    const result = PriceParser.parse("Rp 1,5 Miliar");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(1_500_000_000);
  });

  it('parses "165 jt" (juta suffix, no Rp prefix) to 165000000', () => {
    const result = PriceParser.parse("165 jt");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(165_000_000);
  });

  it('parses "195 juta" (full "juta" suffix) to 195000000', () => {
    const result = PriceParser.parse("195 juta");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(195_000_000);
  });

  it("parses a plain integer with no currency/suffix", () => {
    const result = PriceParser.parse("50000000");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(50_000_000);
  });

  it('rejects "Rp" with no numeric content after the currency prefix', () => {
    const result = PriceParser.parse("Rp ");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = PriceParser.parse("");
    expect(result.ok).toBe(false);
  });

  it("rejects a string with no numeric content", () => {
    const result = PriceParser.parse("Rp -");
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric magnitude-suffixed text", () => {
    const result = PriceParser.parse("Rp abc Miliar");
    expect(result.ok).toBe(false);
  });

  it('parses "Rp165.000.000" with no space after the currency prefix', () => {
    const result = PriceParser.parse("Rp165.000.000");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(165_000_000);
  });

  it('parses "Rp 2 M" (M magnitude suffix) to 2000000000', () => {
    const result = PriceParser.parse("Rp 2 M");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(2_000_000_000);
  });

  it("rejects a non-string input", () => {
    const result = PriceParser.parse(undefined as unknown as string);
    expect(result.ok).toBe(false);
  });
});
