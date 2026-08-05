import type { BaseEventShape } from "../contracts/base-event.js";

import type { ReplayRange } from "./i-event-replay-provider.js";

/**
 * Event Archive Provider port — Event Sourcing readiness (docs/PROMPT-005.4-ENTERPRISE-
 * EVENT-BUS.md addendum 1). Moves old events out of the hot `IEventStore` into cold storage
 * and back, without deleting the audit/replay trail. Interface only — no implementation
 * ships here.
 */
export interface IEventArchiveProvider {
  archive(range: ReplayRange): Promise<{ readonly archivedCount: number }>;
  retrieveArchived(range: ReplayRange): AsyncIterable<BaseEventShape>;
}
