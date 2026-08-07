import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";
import { KnowledgeQualityAssessmentMode } from "../domain/knowledge-quality-assessment-mode.js";

const VALID_MODES = new Set<string>(Object.values(KnowledgeQualityAssessmentMode));

/** Stage 3 — Assessment: requestId blank, requestedBy blank, targetReference blank, and Assessment Mode must be one of the 8 enumerated values. */
export class AssessmentValidator implements IKnowledgeQualityValidator {
  readonly name = "assessment";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
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
    if (!VALID_MODES.has(input.request.mode)) {
      issues.push({
        path: "request.mode",
        message: "Request mode must be a known Assessment Mode",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
