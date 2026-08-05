import { z } from "zod";

import { baseEventSchema } from "./base-event.js";
import { EventCategory } from "./event-category.js";

/** A record of who did what, for compliance/AI-decision audit trails (e.g. "audit.permission_granted"). */
export const auditEventSchema = baseEventSchema.extend({
  category: z.literal(EventCategory.AUDIT),
  actor: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
});

export type AuditEventShape = z.infer<typeof auditEventSchema>;
export type AuditEvent<TPayload = unknown> = Readonly<Omit<AuditEventShape, "payload">> & {
  readonly payload: TPayload;
};
