import { EVENT_PRIORITY_ORDER, type EventPriority } from "../contracts/event-priority.js";

/** Ascending "urgency rank" — 0 is most urgent (Critical). Used for sorting/comparison outside the Priority Queue. */
export function priorityRank(priority: EventPriority): number {
  return EVENT_PRIORITY_ORDER.indexOf(priority);
}

/** `Array.prototype.sort` comparator: most urgent first. */
export function comparePriority(a: EventPriority, b: EventPriority): number {
  return priorityRank(a) - priorityRank(b);
}
