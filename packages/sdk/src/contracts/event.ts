/**
 * Type-only mirror of the Event Contract (contracts/event.contract.md,
 * schemas/event.schema.json, docs/003.5-CONTRACT-FIRST-DESIGN.md §10).
 * No Event Bus implementation exists yet — see agent.ts's file-level note, which applies equally here.
 */
export interface EventContract<TPayload = unknown> {
  readonly event_id: string;
  /** `<domain>.<entity>_<past_tense_verb>` snake_case, per Constitution §6.4 (e.g. "lead.hot"). */
  readonly event_name: string;
  readonly publisher: string;
  readonly subscriber?: readonly string[];
  readonly payload_schema: string;
  readonly payload: TPayload;
  readonly priority: number;
  readonly retry: {
    readonly max_attempts: number;
    readonly backoff_strategy: "fixed" | "linear" | "exponential";
    readonly backoff_base_ms: number;
  };
  readonly delay?: string;
  readonly dead_letter: string;
  readonly schedule?: string;
  readonly trace_id: string;
  readonly correlation_id: string;
  readonly tenant_id: string;
  readonly timestamp: string;
}
