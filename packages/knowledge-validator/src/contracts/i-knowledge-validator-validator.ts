import type { KnowledgeValidatorContext } from "../context/knowledge-validator-context.js";
import type { KnowledgeValidationConfiguration } from "../domain/knowledge-validation-configuration.js";
import type { KnowledgeValidationDecision } from "../domain/knowledge-validation-decision.js";
import type { KnowledgeValidationMetadata } from "../domain/knowledge-validation-metadata.js";
import type { KnowledgeValidationPolicy } from "../domain/knowledge-validation-policy.js";
import type { KnowledgeValidationRequest } from "../domain/knowledge-validation-request.js";
import type { KnowledgeValidationRule } from "../domain/knowledge-validation-rule.js";
import type { KnowledgeValidationState } from "../domain/knowledge-validation-state.js";
import type { KnowledgeValidationStatisticsSnapshot } from "../domain/knowledge-validation-statistics-snapshot.js";
import type { KnowledgeValidation } from "../domain/knowledge-validation.js";

export interface ValidatorStageIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidatorStageResult {
  readonly valid: boolean;
  readonly issues: readonly ValidatorStageIssue[];
}

/**
 * The unit every one of the 12 `KnowledgeValidatorValidator` stages reads.
 * `currentState`/`targetState` feed the Lifecycle stage. Registry-derived facts
 * (`rulesResolvable`, `resolvedRules`, `policy`, `configuration`, `decision`,
 * `statisticsSnapshot`) are precomputed by the caller (Pipeline/Facade), matching the
 * "Validator stages are pure functions over their input" convention used across every
 * prior AOS Knowledge package.
 */
export interface KnowledgeValidatorValidationInput {
  readonly validation: KnowledgeValidation;
  readonly metadata: KnowledgeValidationMetadata;
  readonly request: KnowledgeValidationRequest;
  readonly context: KnowledgeValidatorContext;
  readonly currentState?: KnowledgeValidationState;
  readonly targetState?: KnowledgeValidationState;
  readonly rulesResolvable?: boolean;
  readonly resolvedRules?: readonly KnowledgeValidationRule[];
  readonly policy?: KnowledgeValidationPolicy;
  readonly configuration?: KnowledgeValidationConfiguration;
  readonly decision?: KnowledgeValidationDecision;
  readonly statisticsSnapshot?: KnowledgeValidationStatisticsSnapshot;
}

/** A caller-supplied extra validation stage `KnowledgeValidatorValidator` runs alongside its own 12 built-in stages. */
export interface IKnowledgeValidatorStage {
  readonly name: string;
  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult;
}
