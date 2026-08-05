import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/**
 * A structured, human-friendly recurrence — the simpler alternative to a raw Cron
 * Expression for the common "every day/week/month at HH:mm" case.
 */
export const recurringScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.RECURRING),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  /** 24-hour "HH:mm", evaluated in `timezone`. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be "HH:mm" (24-hour)'),
  /** Required when frequency is "weekly" — 0 (Sunday) through 6 (Saturday). */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  /** Required when frequency is "monthly" — 1 through 31 (clamped to the month's last day). */
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

export type RecurringSchedule = z.infer<typeof recurringScheduleSchema>;
