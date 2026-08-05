import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** Fires exactly once, `delayMs` after the Job was created. */
export const delayedScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.DELAYED),
  delayMs: z.number().int().nonnegative(),
});

export type DelayedSchedule = z.infer<typeof delayedScheduleSchema>;
