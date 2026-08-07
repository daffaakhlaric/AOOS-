import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";
import { isKnowledgeValidatorToken } from "../token/knowledge-validator-token.js";

/** Stage 1 — Identity: blank/mismatched validationId between metadata/request/context, and a malformed token. */
export class IdentityValidator implements IKnowledgeValidatorStage {
  readonly name = "identity";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (input.validation.validationId.trim().length === 0) {
      issues.push({ path: "validation.validationId", message: "validationId must not be empty" });
    }
    if (input.validation.validationId !== input.metadata.validationId) {
      issues.push({
        path: "metadata.validationId",
        message: "Metadata validationId must match Validation validationId",
      });
    }
    if (input.validation.validationId !== input.request.validationId) {
      issues.push({
        path: "request.validationId",
        message: "Request validationId must match Validation validationId",
      });
    }
    if (!isKnowledgeValidatorToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed KnowledgeValidatorToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
