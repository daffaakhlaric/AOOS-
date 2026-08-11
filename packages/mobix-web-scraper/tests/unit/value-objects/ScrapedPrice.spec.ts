import { describe, expect, it } from "vitest";

import { ScrapedPrice } from "../../../src/domain/value-objects/ScrapedPrice.js";

describe("ScrapedPrice", () => {
  it("creates a valid price", () => {
    const result = ScrapedPrice.create(165_000_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.idr).toBe(165_000_000);
  });

  it("rounds a fractional price", () => {
    const result = ScrapedPrice.create(165_000_000.6);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.idr).toBe(165_000_001);
  });

  it("rejects a negative price", () => {
    const result = ScrapedPrice.create(-1);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-finite price", () => {
    const result = ScrapedPrice.create(Number.NaN);
    expect(result.ok).toBe(false);
  });

  it("equals compares by value", () => {
    const a = ScrapedPrice.create(100).ok
      ? (ScrapedPrice.create(100) as { ok: true; value: ScrapedPrice }).value
      : null;
    const b = ScrapedPrice.create(100).ok
      ? (ScrapedPrice.create(100) as { ok: true; value: ScrapedPrice }).value
      : null;
    expect(a && b && a.equals(b)).toBe(true);
  });

  it("toString formats as Indonesian Rupiah", () => {
    const result = ScrapedPrice.create(1_000_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toString()).toContain("Rp");
  });
});
