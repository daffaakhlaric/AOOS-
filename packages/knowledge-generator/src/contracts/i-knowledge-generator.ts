import type { KnowledgeGeneratorContext } from "../context/knowledge-generator-context.js";
import type { KnowledgeGenerationAudit } from "../domain/knowledge-generation-audit.js";
import type { KnowledgeGenerationConfiguration } from "../domain/knowledge-generation-configuration.js";
import type { KnowledgeGenerationContext as KnowledgeGenerationContextRef } from "../domain/knowledge-generation-context.js";
import type { KnowledgeGenerationHistoryEntry } from "../domain/knowledge-generation-history-entry.js";
import type { KnowledgeGenerationLogEntry } from "../domain/knowledge-generation-log-entry.js";
import type { KnowledgeGenerationMetadata } from "../domain/knowledge-generation-metadata.js";
import type { KnowledgeGenerationPolicy } from "../domain/knowledge-generation-policy.js";
import type { KnowledgeGenerationPromptReference } from "../domain/knowledge-generation-prompt-reference.js";
import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";
import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";
import type { KnowledgeGenerationState } from "../domain/knowledge-generation-state.js";

/**
 * "IKnowledgeGenerator" — the read-only view surface `KnowledgeGenerationRecord`
 * implements over one Generation's execution envelope. Named distinctly from the
 * `KnowledgeGenerator` façade to avoid a same-name collision at the package barrel.
 */
export interface IKnowledgeGenerator {
  readonly id: string;
  readonly token: string;
  readonly generationId: string;
  readonly state: KnowledgeGenerationState;
  readonly metadata: KnowledgeGenerationMetadata;
  readonly request: KnowledgeGenerationRequest;
  readonly context: KnowledgeGeneratorContext;
  readonly result?: KnowledgeGenerationResult;
  readonly contextReference?: KnowledgeGenerationContextRef;
  readonly promptReference?: KnowledgeGenerationPromptReference;
  readonly policy?: KnowledgeGenerationPolicy;
  readonly configuration?: KnowledgeGenerationConfiguration;
  readonly history: readonly KnowledgeGenerationHistoryEntry[];
  readonly auditTrail: readonly KnowledgeGenerationAudit[];
  readonly logs: readonly KnowledgeGenerationLogEntry[];
}
