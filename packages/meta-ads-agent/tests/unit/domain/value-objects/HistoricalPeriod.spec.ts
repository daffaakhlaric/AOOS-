import { describe, expect, it } from "vitest";

import { HistoricalPeriod } from "../../../../src/domain/value-objects/HistoricalPeriod.js";

describe("HistoricalPeriod", () => {
  it("creates a valid 90-day period", () => {
    const from = new Date("2026-05-11T00:00:00.000Z");
    const to = new Date("2026-08-09T00:00:00.000Z");
    const result = HistoricalPeriod.create({ from, to, days: 90 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.from).toBe(from);
      expect(result.value.to).toBe(to);
      expect(result.value.days).toBe(90);
    }
  });

  it("rejects to preceding from", () => {
    const result = HistoricalPeriod.create({
      from: new Date("2026-08-09T00:00:00.000Z"),
      to: new Date("2026-05-11T00:00:00.000Z"),
      days: 90,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive days value", () => {
    const result = HistoricalPeriod.create({
      from: new Date("2026-05-11T00:00:00.000Z"),
      to: new Date("2026-08-09T00:00:00.000Z"),
      days: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer days value", () => {
    const result = HistoricalPeriod.create({
      from: new Date("2026-05-11T00:00:00.000Z"),
      to: new Date("2026-08-09T00:00:00.000Z"),
      days: 90.5,
    });
    expect(result.ok).toBe(false);
  });
});
