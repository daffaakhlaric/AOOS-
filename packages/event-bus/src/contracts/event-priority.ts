/** Event Priority (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md) — drives buffer/dispatch ordering. */
export enum EventPriority {
  CRITICAL = "critical",
  HIGH = "high",
  NORMAL = "normal",
  LOW = "low",
  BACKGROUND = "background",
}

/** Highest priority first — the order the Priority Queue (buffer/priority-queue.ts) drains in. */
export const EVENT_PRIORITY_ORDER: readonly EventPriority[] = [
  EventPriority.CRITICAL,
  EventPriority.HIGH,
  EventPriority.NORMAL,
  EventPriority.LOW,
  EventPriority.BACKGROUND,
];
