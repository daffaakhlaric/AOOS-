import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** A notification about the infrastructure a Runtime component depends on (e.g. "registry.reloaded"). */
export const infrastructureEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.INFRASTRUCTURE),
  resource: z.string().min(1).optional(),
});

export type InfrastructureEventShape = z.infer<typeof infrastructureEventSchema>;
export type InfrastructureEvent<TPayload = unknown> = Readonly<
  Omit<InfrastructureEventShape, "payload">
> & {
  readonly payload: TPayload;
};
