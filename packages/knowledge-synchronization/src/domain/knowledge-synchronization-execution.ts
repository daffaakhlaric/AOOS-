import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";

import type { KnowledgeChangeRecord } from "./knowledge-change-record.js";
import type { KnowledgeSynchronizationHistory } from "./knowledge-synchronization-history.js";
import type { KnowledgeSynchronizationInstance } from "./knowledge-synchronization-instance.js";
import type { KnowledgeSynchronizationJob } from "./knowledge-synchronization-job.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` + `context` + `job` + the accumulated `changes` + the ordered `history` of
 * every transition so far. Mirrors `@aos/knowledge-retrieval`'s
 * `KnowledgeRetrievalExecution` triple, extended with `job`/`changes`.
 */
export interface KnowledgeSynchronizationExecution {
  readonly instance: KnowledgeSynchronizationInstance;
  readonly context: KnowledgeSynchronizationContext;
  readonly job: KnowledgeSynchronizationJob;
  readonly changes: readonly KnowledgeChangeRecord[];
  readonly history: KnowledgeSynchronizationHistory;
}
