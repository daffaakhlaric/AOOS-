import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";
import { isKnowledgeGeneratorToken } from "../token/knowledge-generator-token.js";

/** Stage 1 — Identity: blank/mismatched generationId between metadata/request/context, and a malformed token. */
export class IdentityValidator implements IKnowledgeGeneratorValidator {
  readonly name = "identity";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.generation.generationId.trim().length === 0) {
      issues.push({ path: "generation.generationId", message: "generationId must not be empty" });
    }
    if (input.generation.generationId !== input.metadata.generationId) {
      issues.push({
        path: "metadata.generationId",
        message: "Metadata generationId must match Generation generationId",
      });
    }
    if (input.generation.generationId !== input.request.generationId) {
      issues.push({
        path: "request.generationId",
        message: "Request generationId must match Generation generationId",
      });
    }
    if (!isKnowledgeGeneratorToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed KnowledgeGeneratorToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
