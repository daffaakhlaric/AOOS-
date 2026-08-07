import type { EmbeddingContext } from "../context/embedding-context.js";

import type { EmbeddingAudit } from "./embedding-audit.js";
import type { EmbeddingConfiguration } from "./embedding-configuration.js";
import type { EmbeddingHistoryEntry } from "./embedding-history-entry.js";
import type { EmbeddingLogEntry } from "./embedding-log-entry.js";
import type { EmbeddingMetadata } from "./embedding-metadata.js";
import type { EmbeddingModel } from "./embedding-model.js";
import type { EmbeddingNamespace } from "./embedding-namespace.js";
import type { EmbeddingProvider } from "./embedding-provider.js";
import type { EmbeddingRequest } from "./embedding-request.js";
import type { EmbeddingResultMetadata } from "./embedding-result-metadata.js";
import type { Embedding } from "./embedding.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` (the `Embedding`) + `context` + `metadata` + `request`, plus whatever has
 * been resolved so far (`resolvedProvider`/`resolvedModel`/`resolvedNamespace`/
 * `configuration`), the ResultMetadata recorded against this Embedding, the ordered
 * `history` of every transition, and the Audit/Logging metadata the Pipeline stages
 * stamp onto it. Immutable — every stage returns an updated copy.
 */
export interface EmbeddingExecution {
  readonly instance: Embedding;
  readonly context: EmbeddingContext;
  readonly metadata: EmbeddingMetadata;
  readonly request: EmbeddingRequest;
  readonly resolvedProvider?: EmbeddingProvider;
  readonly resolvedModel?: EmbeddingModel;
  readonly resolvedNamespace?: EmbeddingNamespace;
  readonly configuration?: EmbeddingConfiguration;
  readonly resultMetadata: readonly EmbeddingResultMetadata[];
  readonly history: readonly EmbeddingHistoryEntry[];
  readonly auditTrail: readonly EmbeddingAudit[];
  readonly logs: readonly EmbeddingLogEntry[];
}
