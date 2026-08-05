/**
 * The formal Event Namespace list (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md). An event's
 * `type` (e.g. "agent.created") must be namespace-qualified — its first dot-segment must be
 * one of these values. `capability` was added per the 005.4 addendum so that 005.8 (Tool
 * SDK) can publish `capability.resolved`/`capability.failed`/`capability.deprecated`
 * without a future Event Bus contract change.
 */
export const EVENT_NAMESPACES = [
  "agent",
  "workflow",
  "tool",
  "registry",
  "scheduler",
  "memory",
  "planning",
  "reasoning",
  "reflection",
  "analytics",
  "simulation",
  "tenant",
  "system",
  "audit",
  "monitoring",
  "capability",
] as const;

export type EventNamespace = (typeof EVENT_NAMESPACES)[number];

const NAMESPACE_SET: ReadonlySet<string> = new Set(EVENT_NAMESPACES);

/** The dot-segment before the first `.` in an event type (e.g. "agent.created" → "agent"). */
export function extractEventNamespace(eventType: string): string {
  return eventType.split(".")[0]!;
}

export function isValidEventNamespace(eventType: string): boolean {
  return NAMESPACE_SET.has(extractEventNamespace(eventType));
}
