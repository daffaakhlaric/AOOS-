import { z } from "zod";

import { EventCategory } from "./event-category.js";
import { EventPriority } from "./event-priority.js";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Every field an AOS event carries, regardless of category (docs/PROMPT-005.4-ENTERPRISE-
 * EVENT-BUS.md — "Setiap Event Memiliki"). `type` is the namespace-qualified event name
 * (e.g. "agent.created") that Routing (router/event-router.ts) and Namespace Subscription
 * key off of — it is the concrete mechanism behind the "Support: Namespace, Topic, Pattern"
 * routing requirement, even though it isn't spelled out as its own bullet in the field list.
 */
export const baseEventSchema = z.object({
  eventId: z.string().uuid(),
  /** Namespace-qualified event name, e.g. "agent.created" — see contracts/event-namespace.ts. */
  type: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9_]*(\.[a-zA-Z0-9_]+)+$/,
      'type must be namespace-qualified, e.g. "agent.created"',
    ),
  category: z.nativeEnum(EventCategory),
  correlationId: z.string().min(1),
  /** Id of the event that caused this one, if any — absent for a root/originating event. */
  causationId: z.string().min(1).optional(),
  /** Absent for platform/system-wide events not scoped to a single tenant. */
  tenantId: z.string().min(1).optional(),
  source: z.string().min(1),
  producer: z.string().min(1),
  timestamp: z.string().min(1),
  priority: z.nativeEnum(EventPriority).default(EventPriority.NORMAL),
  /** SemVer of the event's own business meaning (breaking payload change bumps this). */
  version: z.string().regex(SEMVER_PATTERN, "version must be a SemVer string (e.g. 1.0.0)"),
  /** SemVer of the wire schema shape, checked independently of `version` — see validator/version-validator.ts. */
  schemaVersion: z
    .string()
    .regex(SEMVER_PATTERN, "schemaVersion must be a SemVer string (e.g. 1.0.0)"),
  payload: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  traceId: z.string().min(1).optional(),
});

export type BaseEventShape = z.infer<typeof baseEventSchema>;

/** Generic-payload view of a validated event — `TPayload` is asserted by the caller, not re-validated here. */
export type BaseEvent<TPayload = unknown> = Readonly<Omit<BaseEventShape, "payload">> & {
  readonly payload: TPayload;
};
