import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";
import { KnowledgeQualityAssessmentMode } from "../domain/knowledge-quality-assessment-mode.js";

/**
 * Stage 9 — Dependency: cross-field structural dependency checks, e.g. every
 * non-`Custom` Assessment Mode requires at least one Rule or a Profile — a real
 * dependency rule between two fields of the same Request, distinct from Stage 4/5's
 * simple resolvability checks.
 */
export class DependencyValidator implements IKnowledgeQualityValidator {
  readonly name = "dependency";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (
      input.request.mode !== KnowledgeQualityAssessmentMode.CUSTOM &&
      input.request.ruleIds.length === 0 &&
      !input.request.profileId
    ) {
      issues.push({
        path: "request.ruleIds",
        message: `Assessment Mode "${input.request.mode}" requires at least one Rule or a Profile`,
      });
    }
    /* A referenced Policy with `requireApproval` and no Configuration is a common
     * misconfiguration in production — flagged only when a Policy was actually
     * resolved (so this stage stays a pure function of its input). */
    if (input.policy?.requireApproval && !input.configuration) {
      issues.push({
        path: "request.configurationId",
        message: `Policy "${input.request.policyId}" requires approval — a Configuration record is required`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
