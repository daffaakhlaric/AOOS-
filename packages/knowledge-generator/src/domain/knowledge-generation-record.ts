import type { KnowledgeGeneratorContext } from "../context/knowledge-generator-context.js";
import type { IKnowledgeGenerator } from "../contracts/i-knowledge-generator.js";

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
import type { KnowledgeGenerationState } from "./knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "./knowledge-generator-execution.js";

/**
 * "KnowledgeGenerationRecord" — the concrete, read-only view over one Generation's
 * `KnowledgeGeneratorExecution`. Every operation that hands a Generation back to a
 * caller returns one of these rather than the raw execution envelope. Named distinctly
 * from the `KnowledgeGenerator` façade (`generator/knowledge-generator.ts`, the "Public
 * API" name) to avoid a same-name collision at the package barrel — matching the
 * `KnowledgeMarketplace`/`KnowledgeMarketplaceRecord` convention.
 */
export class KnowledgeGenerationRecord implements IKnowledgeGenerator {
  constructor(private readonly execution: KnowledgeGeneratorExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get generationId(): string {
    return this.execution.instance.generationId;
  }

  get state(): KnowledgeGenerationState {
    return this.execution.instance.state;
  }

  get metadata(): KnowledgeGenerationMetadata {
    return this.execution.metadata;
  }

  get request(): KnowledgeGenerationRequest {
    return this.execution.request;
  }

  get context(): KnowledgeGeneratorContext {
    return this.execution.context;
  }

  get result(): KnowledgeGenerationResult | undefined {
    return this.execution.result;
  }

  get contextReference(): KnowledgeGenerationContext | undefined {
    return this.execution.contextReference;
  }

  get promptReference(): KnowledgeGenerationPromptReference | undefined {
    return this.execution.promptReference;
  }

  get policy(): KnowledgeGenerationPolicy | undefined {
    return this.execution.policy;
  }

  get configuration(): KnowledgeGenerationConfiguration | undefined {
    return this.execution.configuration;
  }

  get history(): readonly KnowledgeGenerationHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly KnowledgeGenerationAudit[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly KnowledgeGenerationLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): KnowledgeGeneratorExecution {
    return this.execution;
  }
}
