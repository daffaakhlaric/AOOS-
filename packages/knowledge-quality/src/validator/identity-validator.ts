import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";
import { isKnowledgeQualityToken } from "../token/knowledge-quality-token.js";

/** Stage 1 — Identity: blank/mismatched assessmentId between metadata/request/context, and a malformed token. */
export class IdentityValidator implements IKnowledgeQualityValidator {
  readonly name = "identity";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (input.assessment.assessmentId.trim().length === 0) {
      issues.push({ path: "assessment.assessmentId", message: "assessmentId must not be empty" });
    }
    if (input.assessment.assessmentId !== input.metadata.assessmentId) {
      issues.push({
        path: "metadata.assessmentId",
        message: "Metadata assessmentId must match Assessment assessmentId",
      });
    }
    if (input.assessment.assessmentId !== input.request.assessmentId) {
      issues.push({
        path: "request.assessmentId",
        message: "Request assessmentId must match Assessment assessmentId",
      });
    }
    if (!isKnowledgeQualityToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed KnowledgeQualityToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
