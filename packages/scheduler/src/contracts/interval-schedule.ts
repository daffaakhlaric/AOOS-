import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** Fires every `everyMs` milliseconds, starting from `startAt` (or job creation time). */
export const intervalScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.INTERVAL),
  everyMs: z.number().int().positive(),
});

export type IntervalSchedule = z.infer<typeof intervalScheduleSchema>;
