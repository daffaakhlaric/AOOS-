import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** A standard 5-field Cron Expression ("minute hour day-of-month month day-of-week") — parsed by planner/cron-parser.ts, structurally checked by validator/cron-validator.ts. */
export const cronScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.CRON),
  expression: z.string().min(1),
});

export type CronSchedule = z.infer<typeof cronScheduleSchema>;
