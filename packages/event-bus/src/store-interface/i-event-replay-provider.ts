import type { BaseEventShape } from "../contracts/base-event.js";

export interface ReplayRange {
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly fromEventId?: string;
  readonly toEventId?: string;
}

/**
 * Event-Sourcing-store-facing Replay port — Event Sourcing readiness (docs/PROMPT-005.4-
 * ENTERPRISE-EVENT-BUS.md addendum 1). Streams events out of an `IEventStore` in append
 * order for a given range, the low-level primitive `replay/i-event-replay.ts`'s
 * application-facing `IEventReplay` would be implemented on top of. Interface only — no
 * implementation ships here (enables: replaying AI Agent activity, auditing decisions,
 * re-simulating scenarios, re-training/re-evaluating agent strategy from history).
 */
export interface IEventReplayProvider {
  replayRange(range: ReplayRange): AsyncIterable<BaseEventShape>;
}
