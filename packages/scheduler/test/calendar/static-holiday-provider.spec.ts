import { describe, expect, it } from "vitest";

import { StaticHolidayProvider } from "../../src/calendar/static-holiday-provider.js";

describe("Holiday Test — StaticHolidayProvider", () => {
  it("reports a configured date as a holiday", () => {
    const provider = new StaticHolidayProvider(["2026-01-01", "2026-12-25"]);
    expect(provider.isHoliday("2026-01-01")).toBe(true);
    expect(provider.isHoliday("2026-12-25")).toBe(true);
  });

  it("reports an unconfigured date as not a holiday", () => {
    const provider = new StaticHolidayProvider(["2026-01-01"]);
    expect(provider.isHoliday("2026-06-15")).toBe(false);
  });

  it("defaults to no holidays at all", () => {
    expect(new StaticHolidayProvider().isHoliday("2026-01-01")).toBe(false);
  });
});
