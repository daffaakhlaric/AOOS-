import type { BaseEventShape } from "../contracts/base-event.js";
import type { RetryMetadata } from "../contracts/retry-policy.js";

export interface DeadLetterEntry {
  readonly event: BaseEventShape;
  readonly reason: string;
  readonly retryMetadata?: RetryMetadata;
  readonly failedAt: string;
}

/**
 * Dead Letter Queue port (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Interface only. Belum
 * persistence."). No implementation ships in this package — the Dispatcher (dispatcher/
 * event-dispatcher.ts) accepts an optional `IDeadLetterQueue` and calls `enqueue()` when a
 * subscriber's Retry Policy is exhausted; without one configured, exhausted deliveries are
 * simply dropped (and reported via metrics/events).
 */
export interface IDeadLetterQueue {
  enqueue(entry: DeadLetterEntry): void | Promise<void>;
  list(): readonly DeadLetterEntry[] | Promise<readonly DeadLetterEntry[]>;
}
