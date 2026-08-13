import { describe, expect, it } from "vitest";

import { ReportPeriod } from "../../../src/domain/value-objects/ReportPeriod.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ReportPeriod", () => {
  it("builds a calendar month via forMonth", () => {
    const period = unwrap(ReportPeriod.forMonth(8, 2026));
    expect(period.month).toBe(8);
    expect(period.year).toBe(2026);
    expect(period.fromDate.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(period.toDate.toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("rejects month outside 1-12", () => {
    const error = unwrapErr(ReportPeriod.forMonth(13, 2026));
    expect(error.message).toContain("month");
  });

  it("rejects year below 2000", () => {
    const error = unwrapErr(ReportPeriod.forMonth(1, 1999));
    expect(error.message).toContain("year");
  });

  it("create() rejects an out-of-range month", () => {
    const error = unwrapErr(
      ReportPeriod.create({
        month: 0,
        year: 2026,
        fromDate: new Date("2026-08-01"),
        toDate: new Date("2026-08-31"),
      }),
    );
    expect(error.message).toContain("month");
  });

  it("create() rejects an out-of-range year", () => {
    const error = unwrapErr(
      ReportPeriod.create({
        month: 8,
        year: 1999,
        fromDate: new Date("2026-08-01"),
        toDate: new Date("2026-08-31"),
      }),
    );
    expect(error.message).toContain("year");
  });

  it("create() rejects fromDate after toDate", () => {
    const error = unwrapErr(
      ReportPeriod.create({
        month: 8,
        year: 2026,
        fromDate: new Date("2026-08-31"),
        toDate: new Date("2026-08-01"),
      }),
    );
    expect(error.message).toContain("fromDate");
  });

  it("create() accepts a valid explicit range", () => {
    const period = unwrap(
      ReportPeriod.create({
        month: 8,
        year: 2026,
        fromDate: new Date("2026-08-01"),
        toDate: new Date("2026-08-31"),
      }),
    );
    expect(period.month).toBe(8);
  });

  it("toLabel() formats as YYYY-MM, zero-padded", () => {
    const period = unwrap(ReportPeriod.forMonth(3, 2026));
    expect(period.toLabel()).toBe("2026-03");
  });

  it("previousMonth() steps back within the same year", () => {
    const period = unwrap(ReportPeriod.forMonth(8, 2026));
    const prev = period.previousMonth();
    expect(prev.month).toBe(7);
    expect(prev.year).toBe(2026);
  });

  it("previousMonth() wraps across a year boundary (January -> prior December)", () => {
    const period = unwrap(ReportPeriod.forMonth(1, 2026));
    const prev = period.previousMonth();
    expect(prev.month).toBe(12);
    expect(prev.year).toBe(2025);
  });
});
