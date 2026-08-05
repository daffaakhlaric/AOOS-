import { z } from "zod";

import { calendarScheduleSchema } from "./calendar-schedule.js";
import { cronScheduleSchema } from "./cron-schedule.js";
import { delayedScheduleSchema } from "./delayed-schedule.js";
import { dependencyScheduleSchema } from "./dependency-schedule.js";
import { intervalScheduleSchema } from "./interval-schedule.js";
import { manualScheduleSchema } from "./manual-schedule.js";
import { oneTimeScheduleSchema } from "./one-time-schedule.js";
import { recurringScheduleSchema } from "./recurring-schedule.js";

/** The 8 Supported Schedule kinds (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md), as one discriminated union keyed by `type`. */
export const scheduleSchema = z.discriminatedUnion("type", [
  oneTimeScheduleSchema,
  recurringScheduleSchema,
  intervalScheduleSchema,
  cronScheduleSchema,
  calendarScheduleSchema,
  delayedScheduleSchema,
  dependencyScheduleSchema,
  manualScheduleSchema,
]);

export type Schedule = z.infer<typeof scheduleSchema>;
