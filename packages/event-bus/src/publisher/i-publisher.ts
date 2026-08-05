import type { BaseEventShape } from "../contracts/base-event.js";
import type { EventCategory } from "../contracts/event-category.js";
import type { EventPriority } from "../contracts/event-priority.js";

export interface PublishInput<TPayload = unknown> {
  readonly type: string;
  readonly category: EventCategory;
  readonly payload: TPayload;
  readonly source: string;
  readonly producer: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly tenantId?: string;
  readonly priority?: EventPriority;
  /** Defaults to "1.0.0". */
  readonly version?: string;
  /** Defaults to "1.0.0". */
  readonly schemaVersion?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
}

/** Publish / PublishAsync / PublishBatch (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Publisher"). */
export interface IPublisher {
  /** Validates, dispatches, and resolves only once every matched subscriber has been delivered to (or exhausted its retries). */
  publish(input: PublishInput): Promise<BaseEventShape>;
  /** Validates and enqueues dispatch, but resolves immediately without waiting for subscriber delivery. */
  publishAsync(input: PublishInput): Promise<BaseEventShape>;
  /** Validates the whole batch atomically (all-or-nothing), then dispatches in Priority order. */
  publishBatch(inputs: readonly PublishInput[]): Promise<readonly BaseEventShape[]>;
}
