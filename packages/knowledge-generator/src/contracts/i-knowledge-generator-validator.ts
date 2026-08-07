import type { KnowledgeGeneratorContext } from "../context/knowledge-generator-context.js";
import type { KnowledgeGenerationConfiguration } from "../domain/knowledge-generation-configuration.js";
import type { KnowledgeGenerationContext } from "../domain/knowledge-generation-context.js";
import type { KnowledgeGenerationMetadata } from "../domain/knowledge-generation-metadata.js";
import type { KnowledgeGenerationPolicy } from "../domain/knowledge-generation-policy.js";
import type { KnowledgeGenerationPromptReference } from "../domain/knowledge-generation-prompt-reference.js";
import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";
import type { KnowledgeGenerationState } from "../domain/knowledge-generation-state.js";
import type { KnowledgeGeneration } from "../domain/knowledge-generation.js";

export interface GeneratorValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface GeneratorValidationResult {
  readonly valid: boolean;
  readonly issues: readonly GeneratorValidationIssue[];
}

/**
 * The unit every Validator stage reads. `currentState`/`targetState` feed the
 * Lifecycle stage. Registry-derived facts (`contextResolvable`, `promptResolvable`,
 * `policy`, `providerAvailable`, `configuration`) are precomputed by the caller
 * (Pipeline/Facade), matching the "Validator stages are pure functions over their
 * input" convention used across every prior AOS Knowledge package.
 */
export interface KnowledgeGeneratorValidationInput {
  readonly generation: KnowledgeGeneration;
  readonly metadata: KnowledgeGenerationMetadata;
  readonly request: KnowledgeGenerationRequest;
  readonly context: KnowledgeGeneratorContext;
  readonly currentState?: KnowledgeGenerationState;
  readonly targetState?: KnowledgeGenerationState;
  readonly contextResolvable?: boolean;
  readonly contextReference?: KnowledgeGenerationContext;
  readonly promptResolvable?: boolean;
  readonly promptReference?: KnowledgeGenerationPromptReference;
  readonly policy?: KnowledgeGenerationPolicy;
  readonly providerAvailable?: boolean;
  readonly configuration?: KnowledgeGenerationConfiguration;
}

/** A caller-supplied extra validation stage `KnowledgeGeneratorValidator` runs alongside its own 12 built-in stages. */
export interface IKnowledgeGeneratorValidator {
  readonly name: string;
  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult;
}
