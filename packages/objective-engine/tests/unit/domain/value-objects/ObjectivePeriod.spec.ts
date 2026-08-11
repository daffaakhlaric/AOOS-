import { describe, expect, it } from "vitest";

import { ObjectivePeriod } from "../../../../src/domain/value-objects/ObjectivePeriod.js";
import { unwrap } from "../../../helpers/result.js";

describe("ObjectivePeriod", () => {
  it("creates a valid period", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    expect(period.monthNumber).toBe(8);
    expect(period.yearNumber).toBe(2026);
  });

  it("rejects month 0", () => {
    expect(ObjectivePeriod.create({ month: 0, year: 2026 }).ok).toBe(false);
  });

  it("rejects month 13", () => {
    expect(ObjectivePeriod.create({ month: 13, year: 2026 }).ok).toBe(false);
  });

  it("rejects a non-integer month", () => {
    expect(ObjectivePeriod.create({ month: 8.5, year: 2026 }).ok).toBe(false);
  });

  it("rejects a year below the minimum", () => {
    expect(ObjectivePeriod.create({ month: 8, year: 1999 }).ok).toBe(false);
  });

  it("rejects a year above the maximum", () => {
    expect(ObjectivePeriod.create({ month: 8, year: 2201 }).ok).toBe(false);
  });

  it("rejects a non-integer year", () => {
    expect(ObjectivePeriod.create({ month: 8, year: 2026.5 }).ok).toBe(false);
  });

  it("daysInMonth returns 31 for August", () => {
    expect(unwrap(ObjectivePeriod.create({ month: 8, year: 2026 })).daysInMonth()).toBe(31);
  });

  it("daysInMonth returns 30 for April", () => {
    expect(unwrap(ObjectivePeriod.create({ month: 4, year: 2026 })).daysInMonth()).toBe(30);
  });

  it("daysInMonth returns 29 for a leap-year February", () => {
    expect(unwrap(ObjectivePeriod.create({ month: 2, year: 2028 })).daysInMonth()).toBe(29);
  });

  it("daysInMonth returns 28 for a non-leap-year February", () => {
    expect(unwrap(ObjectivePeriod.create({ month: 2, year: 2026 })).daysInMonth()).toBe(28);
  });

  it("startDate is the first day of the month at midnight", () => {
    const start = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 })).startDate();
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it("endDate is the last day of the month at 23:59:59.999", () => {
    const end = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 })).endDate();
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("isCurrentOrFuture is true for the current month/year", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    expect(period.isCurrentOrFuture(new Date("2026-08-15T00:00:00.000Z"))).toBe(true);
  });

  it("isCurrentOrFuture is true for a future month, same year", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 9, year: 2026 }));
    expect(period.isCurrentOrFuture(new Date("2026-08-15T00:00:00.000Z"))).toBe(true);
  });

  it("isCurrentOrFuture is true for a future year", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 1, year: 2027 }));
    expect(period.isCurrentOrFuture(new Date("2026-08-15T00:00:00.000Z"))).toBe(true);
  });

  it("isCurrentOrFuture is false for a past month, same year", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 7, year: 2026 }));
    expect(period.isCurrentOrFuture(new Date("2026-08-15T00:00:00.000Z"))).toBe(false);
  });

  it("isCurrentOrFuture is false for a past year", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 12, year: 2025 }));
    expect(period.isCurrentOrFuture(new Date("2026-08-15T00:00:00.000Z"))).toBe(false);
  });

  it("toKey formats as YYYY-MM", () => {
    expect(unwrap(ObjectivePeriod.create({ month: 8, year: 2026 })).toKey()).toBe("2026-08");
  });

  it("toKey zero-pads single-digit months", () => {
    expect(unwrap(ObjectivePeriod.create({ month: 1, year: 2026 })).toKey()).toBe("2026-01");
  });

  it("equals compares month and year", () => {
    const a = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const b = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const c = unwrap(ObjectivePeriod.create({ month: 9, year: 2026 }));
    const d = unwrap(ObjectivePeriod.create({ month: 8, year: 2027 }));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });
});
