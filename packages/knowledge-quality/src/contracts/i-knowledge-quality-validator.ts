import type { KnowledgeQualityContext } from "../context/knowledge-quality-context.js";
import type { KnowledgeQualityAssessmentMetadata } from "../domain/knowledge-quality-assessment-metadata.js";
import type { KnowledgeQualityAssessmentRequest } from "../domain/knowledge-quality-assessment-request.js";
import type { KnowledgeQualityAssessmentState } from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityAssessmentStatisticsSnapshot } from "../domain/knowledge-quality-assessment-statistics-snapshot.js";
import type { KnowledgeQualityAssessment } from "../domain/knowledge-quality-assessment.js";
import type { KnowledgeQualityConfiguration } from "../domain/knowledge-quality-configuration.js";
import type { KnowledgeQualityPolicy } from "../domain/knowledge-quality-policy.js";
import type { KnowledgeQualityProfile } from "../domain/knowledge-quality-profile.js";
import type { KnowledgeQualityRule } from "../domain/knowledge-quality-rule.js";

export interface QualityValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface QualityValidationResult {
  readonly valid: boolean;
  readonly issues: readonly QualityValidationIssue[];
}

/**
 * The unit every Validator stage reads. `currentState`/`targetState` feed the
 * Lifecycle stage. Registry-derived facts (`rulesResolvable`, `resolvedRules`,
 * `profileResolvable`, `profile`, `policy`, `configuration`, `statisticsSnapshot`) are
 * precomputed by the caller (Pipeline/Facade), matching the "Validator stages are pure
 * functions over their input" convention used across every prior AOS Knowledge package.
 */
export interface KnowledgeQualityValidationInput {
  readonly assessment: KnowledgeQualityAssessment;
  readonly metadata: KnowledgeQualityAssessmentMetadata;
  readonly request: KnowledgeQualityAssessmentRequest;
  readonly context: KnowledgeQualityContext;
  readonly currentState?: KnowledgeQualityAssessmentState;
  readonly targetState?: KnowledgeQualityAssessmentState;
  readonly rulesResolvable?: boolean;
  readonly resolvedRules?: readonly KnowledgeQualityRule[];
  readonly profileResolvable?: boolean;
  readonly profile?: KnowledgeQualityProfile;
  readonly policy?: KnowledgeQualityPolicy;
  readonly configuration?: KnowledgeQualityConfiguration;
  readonly statisticsSnapshot?: KnowledgeQualityAssessmentStatisticsSnapshot;
}

/** A caller-supplied extra validation stage `KnowledgeQualityValidator` runs alongside its own 12 built-in stages. */
export interface IKnowledgeQualityValidator {
  readonly name: string;
  validate(input: KnowledgeQualityValidationInput): QualityValidationResult;
}
