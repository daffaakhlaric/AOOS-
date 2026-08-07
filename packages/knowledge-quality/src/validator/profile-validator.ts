import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";

/** Stage 5 — Profile: a declared `profileId` must resolve against the Profile Registry bucket. */
export class ProfileValidator implements IKnowledgeQualityValidator {
  readonly name = "profile";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (input.request.profileId && input.profileResolvable === false) {
      issues.push({
        path: "request.profileId",
        message: `Profile "${input.request.profileId}" does not resolve`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
