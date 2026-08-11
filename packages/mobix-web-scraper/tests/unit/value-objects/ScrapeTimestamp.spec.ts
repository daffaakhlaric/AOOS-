import { describe, expect, it } from "vitest";

import { ScrapeTimestamp } from "../../../src/domain/value-objects/ScrapeTimestamp.js";

describe("ScrapeTimestamp", () => {
  it("creates from a valid Date", () => {
    const d = new Date("2026-08-07T00:00:00.000Z");
    const result = ScrapeTimestamp.create(d);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toISOString()).toBe(d.toISOString());
  });

  it("rejects an invalid Date", () => {
    const result = ScrapeTimestamp.create(new Date("not-a-date"));
    expect(result.ok).toBe(false);
  });

  it("now() uses the injected clock", () => {
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const ts = ScrapeTimestamp.now(() => fixed);
    expect(ts.value.getTime()).toBe(fixed.getTime());
  });

  it("now() uses the real-time default clock when none is injected", () => {
    const before = Date.now();
    const ts = ScrapeTimestamp.now();
    const after = Date.now();
    expect(ts.value.getTime()).toBeGreaterThanOrEqual(before);
    expect(ts.value.getTime()).toBeLessThanOrEqual(after);
  });

  it("value returns a defensive copy", () => {
    const ts = ScrapeTimestamp.now(() => new Date("2026-01-01T00:00:00.000Z"));
    const v = ts.value;
    v.setFullYear(1999);
    expect(ts.value.getFullYear()).toBe(2026);
  });
});
