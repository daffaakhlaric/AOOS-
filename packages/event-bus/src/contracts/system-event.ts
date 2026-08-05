import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** A platform-level notification not tied to one business aggregate (e.g. "system.degraded"). */
export const systemEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.SYSTEM),
  component: z.string().min(1).optional(),
});

export type SystemEventShape = z.infer<typeof systemEventSchema>;
export type SystemEvent<TPayload = unknown> = Readonly<Omit<SystemEventShape, "payload">> & {
  readonly payload: TPayload;
};
