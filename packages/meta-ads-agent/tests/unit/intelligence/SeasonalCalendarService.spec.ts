import { describe, expect, it } from "vitest";

import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { SeasonalCalendarService } from "../../../src/intelligence/SeasonalCalendarService.js";

// All fixture dates below use local noon (`T12:00:00`) to keep day-of-week/day-of-month
// unambiguous across timezones the test runner might execute in.
function d(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

describe("SeasonalCalendarService — GAJIAN", () => {
  it("active on the 28th (isolated: not weekend, not Harbolnas/year-end)", () => {
    const service = new SeasonalCalendarService();
    const active = service.getCurrentEvents(d("2026-01-28"));
    expect(active.map((e) => e.name)).toEqual(["Gajian Akhir Bulan"]);
  });

  it("active on the 1st and 2nd (wraps into the next month)", () => {
    const service = new SeasonalCalendarService();
    expect(service.getCurrentEvents(d("2026-12-01")).map((e) => e.name)).toContain(
      "Gajian Akhir Bulan",
    );
    expect(service.getCurrentEvents(d("2026-12-02")).map((e) => e.name)).toContain(
      "Gajian Akhir Bulan",
    );
  });

  it("daysUntilNextStart returns 0 while already active", () => {
    const service = new SeasonalCalendarService();
    const active = service.getCurrentEvents(d("2026-01-28"));
    const gajian = active.find((e) => e.name === "Gajian Akhir Bulan");
    expect(gajian?.daysUntilNextStart(d("2026-01-28"))).toBe(0);
  });

  it("inactive mid-month, daysUntilNextStart counts to the same month's 25th", () => {
    const service = new SeasonalCalendarService();
    const active = service.getCurrentEvents(d("2026-06-15"));
    expect(active.map((e) => e.name)).not.toContain("Gajian Akhir Bulan");
    const upcoming = service.getUpcomingEvents(10, d("2026-06-15"));
    const gajian = upcoming.find((e) => e.name === "Gajian Akhir Bulan");
    expect(gajian?.daysUntilNextStart(d("2026-06-15"))).toBe(10);
  });
});

describe("SeasonalCalendarService — HARBOLNAS", () => {
  it("daysUntilNextStart returns 0 while already active (annual-range event)", () => {
    const service = new SeasonalCalendarService();
    const active = service.getCurrentEvents(d("2026-11-10"));
    const event = active.find((e) => e.name === "Harbolnas 11.11");
    expect(event?.daysUntilNextStart(d("2026-11-10"))).toBe(0);
  });

  it("11.11 active isolated on Nov 10", () => {
    const service = new SeasonalCalendarService();
    expect(service.getCurrentEvents(d("2026-11-10")).map((e) => e.name)).toEqual([
      "Harbolnas 11.11",
    ]);
  });

  it("12.12 active isolated on Dec 10", () => {
    const service = new SeasonalCalendarService();
    expect(service.getCurrentEvents(d("2026-12-10")).map((e) => e.name)).toEqual([
      "Harbolnas 12.12",
    ]);
  });

  it("11.11 is present in the 7-day upcoming window, 4 days before Nov 9", () => {
    const service = new SeasonalCalendarService();
    const upcoming = service.getUpcomingEvents(7, d("2026-11-05"));
    const event = upcoming.find((e) => e.name === "Harbolnas 11.11");
    expect(event?.daysUntilNextStart(d("2026-11-05"))).toBe(4);
  });

  it("12.12 is the nearest upcoming event on Dec 7 (3 days away — closer than Weekend's 5-day gap on a Monday)", () => {
    const service = new SeasonalCalendarService();
    const upcoming = [...service.getUpcomingEvents(7, d("2026-12-07"))].sort(
      (a, b) => a.daysUntilNextStart(d("2026-12-07")) - b.daysUntilNextStart(d("2026-12-07")),
    );
    expect(upcoming[0]?.name).toBe("Harbolnas 12.12");
    expect(upcoming[0]?.daysUntilNextStart(d("2026-12-07"))).toBe(3);
  });

  it("11.11 already passed this year rolls over to next year's Nov 9", () => {
    const service = new SeasonalCalendarService();
    const upcoming = service.getUpcomingEvents(400, d("2026-11-16"));
    const event = upcoming.find((e) => e.name === "Harbolnas 11.11");
    expect(event?.daysUntilNextStart(d("2026-11-16"))).toBe(358);
  });

  it("both 12.12 and Weekend active on Dec 12, 2026 (a Saturday) — recommendation picks the higher budgetMultiplier", () => {
    const service = new SeasonalCalendarService();
    const active = service.getCurrentEvents(d("2026-12-12"));
    expect(active.map((e) => e.name).sort()).toEqual(["Harbolnas 12.12", "Weekend"]);
    const recommendation = service.getRecommendation("AUTOMOTIVE", d("2026-12-12"));
    expect(recommendation.isSpecialPeriod).toBe(true);
    expect(recommendation.eventName).toBe("Harbolnas 12.12");
    expect(recommendation.budgetMultiplier).toBe(1.5);
  });
});

describe("SeasonalCalendarService — YEAREND", () => {
  it("active isolated on Dec 22", () => {
    const service = new SeasonalCalendarService();
    expect(service.getCurrentEvents(d("2026-12-22")).map((e) => e.name)).toEqual([
      "Bonus Akhir Tahun",
    ]);
  });

  it("upcoming this year — 19 days before Dec 20", () => {
    const service = new SeasonalCalendarService();
    const upcoming = service.getUpcomingEvents(30, d("2026-12-01"));
    const event = upcoming.find((e) => e.name === "Bonus Akhir Tahun");
    expect(event?.daysUntilNextStart(d("2026-12-01"))).toBe(19);
  });
});

describe("SeasonalCalendarService — WEEKEND", () => {
  it("active on Saturday and Sunday", () => {
    const service = new SeasonalCalendarService();
    expect(service.getCurrentEvents(d("2026-01-10")).map((e) => e.name)).toContain("Weekend");
    expect(service.getCurrentEvents(d("2026-02-01")).map((e) => e.name)).toContain("Weekend");
  });

  it("daysUntilNextStart returns 0 while already active", () => {
    const service = new SeasonalCalendarService();
    const active = service.getCurrentEvents(d("2026-01-10"));
    const weekend = active.find((e) => e.name === "Weekend");
    expect(weekend?.daysUntilNextStart(d("2026-01-10"))).toBe(0);
  });

  it("inactive on weekdays, daysUntilNextStart counts to the next Saturday", () => {
    const service = new SeasonalCalendarService();
    const monday = service.getUpcomingEvents(7, d("2026-06-15"));
    expect(monday.find((e) => e.name === "Weekend")?.daysUntilNextStart(d("2026-06-15"))).toBe(5);
    const friday = service.getUpcomingEvents(7, d("2026-11-06"));
    expect(friday.find((e) => e.name === "Weekend")?.daysUntilNextStart(d("2026-11-06"))).toBe(1);
  });
});

describe("SeasonalCalendarService.getRecommendation", () => {
  it("active period: reasoning mentions the event name and scale percentage", () => {
    const service = new SeasonalCalendarService();
    const recommendation = service.getRecommendation("AUTOMOTIVE", d("2026-01-28"));
    expect(recommendation.isSpecialPeriod).toBe(true);
    expect(recommendation.eventName).toBe("Gajian Akhir Bulan");
    expect(recommendation.reasoning).toContain("Gajian Akhir Bulan");
    expect(recommendation.reasoning).toContain("40%");
    expect(recommendation.recommendedAngles).toEqual([AdAngle.DP_RINGAN, AdAngle.KREDIT_SYARIAH]);
  });

  it("AUTOMOTIVE recommendedAngles are real AdAngle members", () => {
    const service = new SeasonalCalendarService();
    const recommendation = service.getRecommendation("AUTOMOTIVE", d("2026-12-22"));
    expect(recommendation.recommendedAngles).toEqual([AdAngle.DISCOVERY, AdAngle.TESTIMONIAL]);
  });

  it("PROPERTY recommendedAngles are real PropertyAdAngle member name strings", () => {
    const service = new SeasonalCalendarService();
    const recommendation = service.getRecommendation("PROPERTY", d("2026-12-22"));
    expect(recommendation.recommendedAngles).toEqual(["INVESTASI", "EXCLUSIVE"]);
  });

  it("upcoming (not yet special) period: reasoning mentions days-until and a teaser call", () => {
    const service = new SeasonalCalendarService();
    const recommendation = service.getRecommendation("AUTOMOTIVE", d("2026-12-07"));
    expect(recommendation.isSpecialPeriod).toBe(false);
    expect(recommendation.upcomingEvent).toBe("Harbolnas 12.12");
    expect(recommendation.daysUntil).toBe(3);
    expect(recommendation.reasoning).toContain("Harbolnas 12.12");
    expect(recommendation.reasoning).toContain("3 hari");
  });

  it("uses the injected clock when no referenceDate is passed", () => {
    const service = new SeasonalCalendarService(() => d("2026-01-28"));
    expect(service.getRecommendation("AUTOMOTIVE").eventName).toBe("Gajian Akhir Bulan");
  });

  it("defaults the clock to the real system time when none is injected", () => {
    const service = new SeasonalCalendarService();
    // No assertion on the specific result (depends on the real wall-clock date) — this only
    // exercises the real `() => new Date()` default so it is not silently untested.
    expect(() => service.getRecommendation("AUTOMOTIVE")).not.toThrow();
  });
});
