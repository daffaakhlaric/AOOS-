import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";
import { KnowledgeValidationCategory } from "../domain/knowledge-validation-category.js";

const VALID_CATEGORIES = new Set<string>(Object.values(KnowledgeValidationCategory));

/**
 * Stage 3 — Validation: checks that the validation REQUEST itself (not the validated
 * knowledge) has well-formed required fields — requestId blank, requestedBy blank,
 * targetReference blank, and Validation Category must be one of the 9 enumerated
 * values.
 *
 * NOTE ON THE TRIPLE "VALIDATION" NAME: this class ("ValidationValidator", stage name
 * "validation") is distinct from (a) the Pipeline's own Stage 1, also named
 * "Validation", which runs the entire 12-stage `KnowledgeValidatorValidator`
 * aggregator, and (b) the `KnowledgeValidatorValidator` aggregator class itself. Stage
 * 1 of the Pipeline is "run the Validator"; Stage 3 of the Validator (this class) is
 * "check the Request is well-formed". See docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md
 * — "Pipeline" for the full three-way distinction.
 */
export class ValidationValidator implements IKnowledgeValidatorStage {
  readonly name = "validation";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (input.request.requestId.trim().length === 0) {
      issues.push({ path: "request.requestId", message: "Request requestId must not be empty" });
    }
    if (input.request.requestedBy.trim().length === 0) {
      issues.push({
        path: "request.requestedBy",
        message: "Request requestedBy must not be empty",
      });
    }
    if (input.request.targetReference.trim().length === 0) {
      issues.push({
        path: "request.targetReference",
        message: "Request targetReference must not be empty",
      });
    }
    if (!VALID_CATEGORIES.has(input.request.category)) {
      issues.push({
        path: "request.category",
        message: "Request category must be a known Validation Category",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
