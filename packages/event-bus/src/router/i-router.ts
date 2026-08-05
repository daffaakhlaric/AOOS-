import type { BaseEventShape } from "../contracts/base-event.js";
import type { EventCategory } from "../contracts/event-category.js";
import type { EventPriority } from "../contracts/event-priority.js";

/**
 * Routing criteria (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Support: Namespace, Topic,
 * Pattern, Tenant, Category, Priority"). Every field present must match; an absent field is
 * a wildcard for that dimension.
 */
export interface RouteCriteria {
  /** Exact namespace (the segment before the first `.` in `type`), e.g. "agent". */
  readonly namespace?: string;
  /** Exact event `type`, e.g. "agent.created". */
  readonly topic?: string;
  /** Glob-style pattern over `type`: `*` matches one segment, `**` matches any depth, e.g. "agent.*", "agent.**". */
  readonly pattern?: string;
  readonly tenantId?: string;
  readonly category?: EventCategory;
  readonly priority?: EventPriority;
}

export interface IRouter {
  matches(event: BaseEventShape, criteria: RouteCriteria): boolean;
}
