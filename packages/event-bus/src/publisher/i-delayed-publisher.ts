import type { BaseEventShape } from "../contracts/base-event.js";

import type { PublishInput } from "./i-publisher.js";

/**
 * Delayed Publish port (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "interface only").
 * No implementation ships in this package — deferred publish requires a durable timer/queue
 * (out of scope: Scheduler is explicitly forbidden in this Engineering Task).
 */
export interface IDelayedPublisher {
  publishDelayed(input: PublishInput, delayMs: number): Promise<BaseEventShape>;
}
