import type { BaseEventShape } from "../contracts/base-event.js";

export interface ReplayQuery {
  readonly correlationId?: string;
  readonly tenantId?: string;
  readonly type?: string;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
}

/**
 * Application-facing Event Replay port (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md —
 * "Interface only. Belum storage."): "replay everything matching this query" for a consumer
 * (e.g. re-driving a Workflow, auditing an AI Agent's decisions). Distinct from
 * `store-interface/i-event-replay-provider.ts`'s `IEventReplayProvider`, which is the
 * lower-level, Event-Sourcing-store-facing "replay this exact event range" contract this
 * interface would be implemented ON TOP OF once a real `IEventStore` exists.
 */
export interface IEventReplay {
  replay(query: ReplayQuery): AsyncIterable<BaseEventShape> | Promise<readonly BaseEventShape[]>;
}
