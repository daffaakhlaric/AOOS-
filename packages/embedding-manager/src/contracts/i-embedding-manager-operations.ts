import type { EmbeddingContext } from "../context/embedding-context.js";
import type { EmbeddingJob } from "../domain/embedding-job.js";
import type { EmbeddingModelName } from "../domain/embedding-model-name.js";
import type { EmbeddingProviderType } from "../domain/embedding-provider-type.js";
import type { EmbeddingRecord } from "../domain/embedding-record.js";

/* ---- Embedding Operations ---- */

export interface CreateEmbeddingInput {
  readonly context: EmbeddingContext;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly textReference: string;
  readonly contentReference?: string;
  readonly providerType: EmbeddingProviderType;
  readonly modelName: EmbeddingModelName;
  readonly namespaceId?: string;
  readonly configurationId?: string;
  readonly requestedBy: string;
  readonly instructions?: string;
}

export interface EmbeddingTokenInput {
  readonly token: string;
  readonly reason?: string;
}

export interface FailEmbeddingInput {
  readonly token: string;
  readonly reason: string;
}

/* ---- Session Operations ---- */

export interface OpenEmbeddingSessionInput {
  readonly token: string;
  readonly holder: string;
  readonly ttlMs?: number;
}

export interface EmbeddingSessionTokenInput {
  readonly token: string;
  readonly ttlMs?: number;
}

/* ---- Job Operations ---- */

export interface CreateEmbeddingJobInput {
  readonly embeddingId: string;
  readonly tenantId: string;
  readonly priority?: number;
  readonly scheduledAt?: string;
}

export interface CreateEmbeddingJobResult {
  readonly job: EmbeddingJob;
}

export interface EmbeddingJobTokenInput {
  readonly jobId: string;
}

export interface FailEmbeddingJobInput {
  readonly jobId: string;
  readonly reason: string;
}

/* ---- Read Operations ---- */

export interface ListEmbeddingsResult {
  readonly embeddings: readonly EmbeddingRecord[];
}
