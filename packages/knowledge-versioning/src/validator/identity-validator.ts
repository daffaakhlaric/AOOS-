import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationIssue,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { isKnowledgeVersionToken } from "../token/knowledge-version-token.js";

/** Stage 1 — Identity: blank/mismatched `versionId`/`assetId` between metadata and context, and a malformed `context.token`. */
export class IdentityValidator implements IKnowledgeVersionValidator {
  readonly name = "identity";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const issues: KnowledgeVersionValidationIssue[] = [];
    if (input.metadata.versionId.trim().length === 0) {
      issues.push({ path: "metadata.versionId", message: "Version versionId must not be empty" });
    }
    if (input.metadata.versionId !== input.context.versionId) {
      issues.push({
        path: "metadata.versionId",
        message: "Version metadata versionId must match Context versionId",
      });
    }
    if (input.metadata.assetId.trim().length === 0) {
      issues.push({ path: "metadata.assetId", message: "Version assetId must not be empty" });
    }
    if (input.metadata.assetId !== input.context.assetId) {
      issues.push({
        path: "metadata.assetId",
        message: "Version metadata assetId must match Context assetId",
      });
    }
    if (!isKnowledgeVersionToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed KnowledgeVersionToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
