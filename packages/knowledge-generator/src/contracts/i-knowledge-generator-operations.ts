import type { KnowledgeGeneratorContext } from "../context/knowledge-generator-context.js";
import type { KnowledgeGenerationAssetType } from "../domain/knowledge-generation-asset-type.js";
import type { KnowledgeGenerationJob } from "../domain/knowledge-generation-job.js";
import type { KnowledgeGenerationMode } from "../domain/knowledge-generation-mode.js";
import type { KnowledgeGenerationProviderType } from "../domain/knowledge-generation-provider-type.js";
import type { KnowledgeGenerationRecord } from "../domain/knowledge-generation-record.js";

/* ---- Generation Operations ---- */

export interface CreateGenerationInput {
  readonly context: KnowledgeGeneratorContext;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly assetType: KnowledgeGenerationAssetType;
  readonly mode: KnowledgeGenerationMode;
  readonly providerType: KnowledgeGenerationProviderType;
  readonly promptReferenceId?: string;
  readonly contextReferenceId?: string;
  readonly policyId?: string;
  readonly configurationId?: string;
  readonly requestedBy: string;
  readonly instructions?: string;
}

export interface GenerationTokenInput {
  readonly token: string;
  readonly reason?: string;
}

export interface FailGenerationInput {
  readonly token: string;
  readonly reason: string;
}

export interface CompleteGenerationResultInput {
  readonly providerId: string;
  readonly contentLocation?: string;
  readonly summary?: string;
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
}

export interface CompleteGenerationInput {
  readonly token: string;
  readonly result: CompleteGenerationResultInput;
  readonly reason?: string;
}

/* ---- Session Operations ---- */

export interface OpenGeneratorSessionInput {
  readonly token: string;
  readonly holder: string;
  readonly ttlMs?: number;
}

export interface GeneratorSessionTokenInput {
  readonly token: string;
  readonly ttlMs?: number;
}

/* ---- Job Operations ---- */

export interface CreateGenerationJobInput {
  readonly generationId: string;
  readonly tenantId: string;
  readonly priority?: number;
  readonly scheduledAt?: string;
}

export interface CreateGenerationJobResult {
  readonly job: KnowledgeGenerationJob;
}

export interface GenerationJobTokenInput {
  readonly jobId: string;
}

export interface FailGenerationJobInput {
  readonly jobId: string;
  readonly reason: string;
}

/* ---- Read Operations ---- */

export interface ListGenerationsResult {
  readonly generations: readonly KnowledgeGenerationRecord[];
}
