import { describe, expect, it } from "vitest";

import { ScrapedKilometer } from "../../../src/domain/value-objects/ScrapedKilometer.js";

describe("ScrapedKilometer", () => {
  it("creates a valid kilometer reading", () => {
    const result = ScrapedKilometer.create(45_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.km).toBe(45_000);
  });

  it("rejects a negative kilometer reading", () => {
    const result = ScrapedKilometer.create(-1);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-finite kilometer reading", () => {
    const result = ScrapedKilometer.create(Number.POSITIVE_INFINITY);
    expect(result.ok).toBe(false);
  });

  it("equals compares by value", () => {
    const a = ScrapedKilometer.create(1000);
    const b = ScrapedKilometer.create(1000);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });

  it("toString includes km unit", () => {
    const result = ScrapedKilometer.create(1000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toString()).toContain("km");
  });
});
