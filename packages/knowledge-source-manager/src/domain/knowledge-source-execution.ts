import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";

import type { KnowledgeSourceHistory } from "./knowledge-source-history.js";
import type { KnowledgeSourceInstance } from "./knowledge-source-instance.js";
import type { KnowledgeSourceMetadataRecord } from "./knowledge-source-metadata-record.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` + `context` + `metadata` + `configuration` + the ordered `history` of every
 * transition so far.
 */
export interface KnowledgeSourceExecution {
  readonly instance: KnowledgeSourceInstance;
  readonly context: KnowledgeSourceContext;
  readonly metadata: KnowledgeSourceMetadataRecord;
  readonly configuration: KnowledgeSourceConfigurationRecord;
  readonly history: KnowledgeSourceHistory;
}
