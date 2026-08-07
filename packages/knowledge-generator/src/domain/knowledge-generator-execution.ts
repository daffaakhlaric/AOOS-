import type { KnowledgeGeneratorContext } from "../context/knowledge-generator-context.js";

import type { KnowledgeGenerationAudit } from "./knowledge-generation-audit.js";
import type { KnowledgeGenerationConfiguration } from "./knowledge-generation-configuration.js";
import type { KnowledgeGenerationContext } from "./knowledge-generation-context.js";
import type { KnowledgeGenerationHistoryEntry } from "./knowledge-generation-history-entry.js";
import type { KnowledgeGenerationLogEntry } from "./knowledge-generation-log-entry.js";
import type { KnowledgeGenerationMetadata } from "./knowledge-generation-metadata.js";
import type { KnowledgeGenerationPolicy } from "./knowledge-generation-policy.js";
import type { KnowledgeGenerationPromptReference } from "./knowledge-generation-prompt-reference.js";
import type { KnowledgeGenerationRequest } from "./knowledge-generation-request.js";
import type { KnowledgeGenerationResult } from "./knowledge-generation-result.js";
import type { KnowledgeGeneration } from "./knowledge-generation.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` (the `KnowledgeGeneration`) + `context` + `metadata` + `request`, plus
 * whatever has been resolved so far (`contextReference`/`promptReference`/`policy`/
 * `configuration`/`result`), the ordered `history` of every transition, and the
 * Audit/Logging metadata the Pipeline stages stamp onto it. Immutable — every stage
 * returns an updated copy.
 */
export interface KnowledgeGeneratorExecution {
  readonly instance: KnowledgeGeneration;
  readonly context: KnowledgeGeneratorContext;
  readonly metadata: KnowledgeGenerationMetadata;
  readonly request: KnowledgeGenerationRequest;
  readonly result?: KnowledgeGenerationResult;
  readonly contextReference?: KnowledgeGenerationContext;
  readonly promptReference?: KnowledgeGenerationPromptReference;
  readonly policy?: KnowledgeGenerationPolicy;
  readonly configuration?: KnowledgeGenerationConfiguration;
  readonly history: readonly KnowledgeGenerationHistoryEntry[];
  readonly auditTrail: readonly KnowledgeGenerationAudit[];
  readonly logs: readonly KnowledgeGenerationLogEntry[];
}
