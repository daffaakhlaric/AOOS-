import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** Fires exactly once, at `fireAt` (an ISO timestamp), then never again. */
export const oneTimeScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.ONE_TIME),
  fireAt: z.string().min(1),
});

export type OneTimeSchedule = z.infer<typeof oneTimeScheduleSchema>;
