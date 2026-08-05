import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** Never fires automatically — only via an explicit Manual Trigger call. */
export const manualScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.MANUAL),
});

export type ManualSchedule = z.infer<typeof manualScheduleSchema>;
