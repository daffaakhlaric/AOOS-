import { z } from "zod";

/**
 * Fields every Schedule kind carries (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md —
 * "Supported Time"). `timezone` must be a valid IANA timezone name — checked by
 * validator/timezone-validator.ts using `Intl.DateTimeFormat` (DST-aware by construction,
 * since every JS Date→timezone conversion already accounts for DST).
 */
export const baseScheduleSchema = z.object({
  timezone: z.string().min(1).default("UTC"),
  /** Execution Window — the schedule never fires before this ISO timestamp, if set. */
  startAt: z.string().min(1).optional(),
  /** Execution Window — the schedule never fires after this ISO timestamp, if set. */
  endAt: z.string().min(1).optional(),
});

export type BaseSchedule = z.infer<typeof baseScheduleSchema>;
