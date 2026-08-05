import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be "HH:mm" (24-hour)');

/**
 * Business Hour Policy configuration (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md —
 * "BUSINESS HOURS": Working Hour, Lunch Break, Weekend). Enforced by
 * `policy/business-hours-policy.ts` — "Belum implementasi penuh": weekend/working-hour/
 * lunch-break checks are real, but there is no holiday-calendar-aware "business day"
 * concept here (that's `IHolidayProvider`, a separate policy).
 */
export const businessHoursConfigSchema = z.object({
  timezone: z.string().min(1).default("UTC"),
  /** 0 (Sunday) through 6 (Saturday) — days NOT in this list are treated as weekend/non-working. */
  workDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  workStart: hhmm.default("09:00"),
  workEnd: hhmm.default("17:00"),
  lunchStart: hhmm.optional(),
  lunchEnd: hhmm.optional(),
});

export type BusinessHoursConfig = z.infer<typeof businessHoursConfigSchema>;
