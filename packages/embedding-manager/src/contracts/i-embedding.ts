import type { EmbeddingContext } from "../context/embedding-context.js";
import type { EmbeddingAudit } from "../domain/embedding-audit.js";
import type { EmbeddingConfiguration } from "../domain/embedding-configuration.js";
import type { EmbeddingHistoryEntry } from "../domain/embedding-history-entry.js";
import type { EmbeddingLogEntry } from "../domain/embedding-log-entry.js";
import type { EmbeddingMetadata } from "../domain/embedding-metadata.js";
import type { EmbeddingModel } from "../domain/embedding-model.js";
import type { EmbeddingNamespace } from "../domain/embedding-namespace.js";
import type { EmbeddingProvider } from "../domain/embedding-provider.js";
import type { EmbeddingRequest } from "../domain/embedding-request.js";
import type { EmbeddingResultMetadata } from "../domain/embedding-result-metadata.js";
import type { EmbeddingState } from "../domain/embedding-state.js";

/**
 * "IEmbedding" — the read-only view surface `EmbeddingRecord` implements over one
 * Embedding's execution envelope. Named distinctly from the `EmbeddingManager` façade to
 * avoid a same-name collision at the package barrel.
 */
export interface IEmbedding {
  readonly id: string;
  readonly token: string;
  readonly embeddingId: string;
  readonly state: EmbeddingState;
  readonly metadata: EmbeddingMetadata;
  readonly request: EmbeddingRequest;
  readonly context: EmbeddingContext;
  readonly resolvedProvider?: EmbeddingProvider;
  readonly resolvedModel?: EmbeddingModel;
  readonly resolvedNamespace?: EmbeddingNamespace;
  readonly configuration?: EmbeddingConfiguration;
  readonly resultMetadata: readonly EmbeddingResultMetadata[];
  readonly history: readonly EmbeddingHistoryEntry[];
  readonly auditTrail: readonly EmbeddingAudit[];
  readonly logs: readonly EmbeddingLogEntry[];
}
