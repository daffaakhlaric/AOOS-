export interface EventSnapshot<TState = unknown> {
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly state: TState;
  readonly takenAt: string;
}

/**
 * Event Snapshot Store port — Event Sourcing readiness (docs/PROMPT-005.4-ENTERPRISE-EVENT-
 * BUS.md addendum 1). Lets a future replay engine reconstruct an aggregate's (e.g. an AI
 * Agent's) state from the nearest snapshot forward, instead of always replaying from event
 * zero. Interface only — no implementation ships here.
 */
export interface IEventSnapshotStore {
  save<TState>(snapshot: EventSnapshot<TState>): Promise<void>;
  getLatest<TState>(aggregateId: string): Promise<EventSnapshot<TState> | undefined>;
}
