import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** Fires at each explicit ISO timestamp in `dates` — the "specific calendar dates" schedule (e.g. quarter-end reporting). */
export const calendarScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.CALENDAR),
  dates: z.array(z.string().min(1)).min(1),
});

export type CalendarSchedule = z.infer<typeof calendarScheduleSchema>;
