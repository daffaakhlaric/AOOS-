import type { IHolidayProvider } from "./i-holiday-provider.js";

/** A trivial, in-memory `IHolidayProvider` backed by an explicit date set — the default until a country-calendar/API-backed provider exists. */
export class StaticHolidayProvider implements IHolidayProvider {
  private readonly holidays: ReadonlySet<string>;

  constructor(holidays: readonly string[] = []) {
    this.holidays = new Set(holidays);
  }

  isHoliday(date: string): boolean {
    return this.holidays.has(date);
  }
}
