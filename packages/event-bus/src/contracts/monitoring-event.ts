import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** An observability sample published onto the bus itself (e.g. "monitoring.queue_depth_sampled"). */
export const monitoringEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.MONITORING),
  metricName: z.string().min(1).optional(),
  metricValue: z.number().optional(),
});

export type MonitoringEventShape = z.infer<typeof monitoringEventSchema>;
export type MonitoringEvent<TPayload = unknown> = Readonly<
  Omit<MonitoringEventShape, "payload">
> & {
  readonly payload: TPayload;
};
