/**
 * Holiday port (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "HOLIDAY"). "Belum
 * implementasi negara. Belum implementasi API." — no country calendar or external API
 * integration ships in this package; `policy/holiday-policy.ts` consumes whatever
 * implementation is injected.
 */
export interface IHolidayProvider {
  /** `date` is a calendar day in "YYYY-MM-DD" form, already resolved to the relevant tenant/business timezone. */
  isHoliday(date: string): boolean | Promise<boolean>;
}
