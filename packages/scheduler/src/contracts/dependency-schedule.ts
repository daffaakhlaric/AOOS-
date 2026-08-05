import { z } from "zod";

import { baseScheduleSchema } from "./base-schedule.js";
import { ScheduleType } from "./schedule-type.js";

/** Fires once every job id in `dependsOnJobIds` has reached `JobState.COMPLETED` — no independent time component. */
export const dependencyScheduleSchema = baseScheduleSchema.extend({
  type: z.literal(ScheduleType.DEPENDENCY),
  dependsOnJobIds: z.array(z.string().min(1)).min(1),
});

export type DependencySchedule = z.infer<typeof dependencyScheduleSchema>;
