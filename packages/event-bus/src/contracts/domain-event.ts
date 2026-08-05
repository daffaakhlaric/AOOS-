import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** A business-meaningful state change (e.g. "agent.created", "workflow.completed"). */
export const domainEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.DOMAIN),
  aggregateId: z.string().min(1).optional(),
  aggregateType: z.string().min(1).optional(),
});

export type DomainEventShape = z.infer<typeof domainEventSchema>;
export type DomainEvent<TPayload = unknown> = Readonly<Omit<DomainEventShape, "payload">> & {
  readonly payload: TPayload;
};
