import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";

import type { KnowledgeProviderHistory } from "./knowledge-provider-history.js";
import type { KnowledgeProviderInstance } from "./knowledge-provider-instance.js";
import type { ProviderMetadataRecord } from "./provider-metadata-record.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` + `context` + `metadata` + the ordered `history` of every transition so
 * far. Mirrors `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationExecution`.
 */
export interface KnowledgeProviderExecution {
  readonly instance: KnowledgeProviderInstance;
  readonly context: KnowledgeProviderContext;
  readonly metadata: ProviderMetadataRecord;
  readonly history: KnowledgeProviderHistory;
}
