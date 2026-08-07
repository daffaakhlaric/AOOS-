import type { EmbeddingContext } from "../context/embedding-context.js";
import type { IEmbedding } from "../contracts/i-embedding.js";

import type { EmbeddingAudit } from "./embedding-audit.js";
import type { EmbeddingConfiguration } from "./embedding-configuration.js";
import type { EmbeddingExecution } from "./embedding-execution.js";
import type { EmbeddingHistoryEntry } from "./embedding-history-entry.js";
import type { EmbeddingLogEntry } from "./embedding-log-entry.js";
import type { EmbeddingMetadata } from "./embedding-metadata.js";
import type { EmbeddingModel } from "./embedding-model.js";
import type { EmbeddingNamespace } from "./embedding-namespace.js";
import type { EmbeddingProvider } from "./embedding-provider.js";
import type { EmbeddingRequest } from "./embedding-request.js";
import type { EmbeddingResultMetadata } from "./embedding-result-metadata.js";
import type { EmbeddingState } from "./embedding-state.js";

/**
 * "EmbeddingRecord" — the concrete, read-only view over one Embedding's
 * `EmbeddingExecution`. Every operation that hands an Embedding back to a caller returns
 * one of these rather than the raw execution envelope. Named distinctly from the
 * `EmbeddingManager` façade (`embedding/embedding-manager.ts`, the "Public API" name) to
 * avoid a same-name collision at the package barrel — matching the
 * `KnowledgeValidator`/`KnowledgeValidationRecord` convention.
 */
export class EmbeddingRecord implements IEmbedding {
  constructor(private readonly execution: EmbeddingExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get embeddingId(): string {
    return this.execution.instance.embeddingId;
  }

  get state(): EmbeddingState {
    return this.execution.instance.state;
  }

  get metadata(): EmbeddingMetadata {
    return this.execution.metadata;
  }

  get request(): EmbeddingRequest {
    return this.execution.request;
  }

  get context(): EmbeddingContext {
    return this.execution.context;
  }

  get resolvedProvider(): EmbeddingProvider | undefined {
    return this.execution.resolvedProvider;
  }

  get resolvedModel(): EmbeddingModel | undefined {
    return this.execution.resolvedModel;
  }

  get resolvedNamespace(): EmbeddingNamespace | undefined {
    return this.execution.resolvedNamespace;
  }

  get configuration(): EmbeddingConfiguration | undefined {
    return this.execution.configuration;
  }

  get resultMetadata(): readonly EmbeddingResultMetadata[] {
    return this.execution.resultMetadata;
  }

  get history(): readonly EmbeddingHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly EmbeddingAudit[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly EmbeddingLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): EmbeddingExecution {
    return this.execution;
  }
}
