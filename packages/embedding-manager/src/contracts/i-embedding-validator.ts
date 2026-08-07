import type { EmbeddingContext } from "../context/embedding-context.js";
import type { EmbeddingConfiguration } from "../domain/embedding-configuration.js";
import type { EmbeddingMetadata } from "../domain/embedding-metadata.js";
import type { EmbeddingModel } from "../domain/embedding-model.js";
import type { EmbeddingNamespace } from "../domain/embedding-namespace.js";
import type { EmbeddingProvider } from "../domain/embedding-provider.js";
import type { EmbeddingRequest } from "../domain/embedding-request.js";
import type { EmbeddingState } from "../domain/embedding-state.js";
import type { EmbeddingStatisticsSnapshot } from "../domain/embedding-statistics-snapshot.js";
import type { EmbeddingVersion } from "../domain/embedding-version.js";
import type { Embedding } from "../domain/embedding.js";

export interface EmbeddingValidatorStageIssue {
  readonly path: string;
  readonly message: string;
}

export interface EmbeddingValidatorStageResult {
  readonly valid: boolean;
  readonly issues: readonly EmbeddingValidatorStageIssue[];
}

/**
 * The unit every one of the 12 `EmbeddingValidator` stages reads. `currentState`/
 * `targetState` feed the Lifecycle stage. Registry-derived facts (`resolvedProvider`,
 * `resolvedModel`, `resolvedNamespace`, `resolvedVersion`, `configuration`,
 * `statisticsSnapshot`) are precomputed by the caller (Pipeline/Facade), matching the
 * "Validator stages are pure functions over their input" convention used across every
 * prior AOS Knowledge package.
 */
export interface EmbeddingValidatorValidationInput {
  readonly embedding: Embedding;
  readonly metadata: EmbeddingMetadata;
  readonly request: EmbeddingRequest;
  readonly context: EmbeddingContext;
  readonly currentState?: EmbeddingState;
  readonly targetState?: EmbeddingState;
  readonly resolvedProvider?: EmbeddingProvider;
  readonly resolvedModel?: EmbeddingModel;
  readonly resolvedNamespace?: EmbeddingNamespace;
  readonly resolvedVersion?: EmbeddingVersion;
  readonly configuration?: EmbeddingConfiguration;
  readonly statisticsSnapshot?: EmbeddingStatisticsSnapshot;
}

/** A caller-supplied extra validation stage `EmbeddingValidator` runs alongside its own 12 built-in stages. */
export interface IEmbeddingValidatorStage {
  readonly name: string;
  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult;
}
