import type { KnowledgeVersionConfigurationRecord } from "../configuration/knowledge-version-configuration-record.js";
import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";

import type { KnowledgeHistoryEntry } from "./knowledge-history.js";
import type { KnowledgeVersionAuditEntry } from "./knowledge-version-audit.js";
import type { KnowledgeVersionInstance } from "./knowledge-version-instance.js";
import type { KnowledgeVersionLogEntry } from "./knowledge-version-log.js";
import type { KnowledgeVersionMetadata } from "./knowledge-version-metadata.js";
import type { KnowledgeVersionTrace } from "./knowledge-version-trace.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` + `context` + `metadata` + `configuration` + the ordered `history` of every
 * transition so far, plus the Tracing/Audit/Logging metadata the Pipeline's stages
 * 4/7/8 stamp onto it. Immutable — every stage returns an updated copy.
 */
export interface KnowledgeVersionExecution {
  readonly instance: KnowledgeVersionInstance;
  readonly context: KnowledgeVersionContext;
  readonly metadata: KnowledgeVersionMetadata;
  readonly configuration: KnowledgeVersionConfigurationRecord;
  readonly history: readonly KnowledgeHistoryEntry[];
  readonly trace?: KnowledgeVersionTrace;
  readonly auditTrail: readonly KnowledgeVersionAuditEntry[];
  readonly logs: readonly KnowledgeVersionLogEntry[];
}
