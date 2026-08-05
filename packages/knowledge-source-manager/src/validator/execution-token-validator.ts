import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";
import { isKnowledgeSourceToken } from "../token/knowledge-source-token.js";

/** Flags a blank or structurally malformed `context.token` (ExecutionToken). */
export class ExecutionTokenValidator implements IKnowledgeSourceValidator {
  readonly name = "executionToken";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    if (!isKnowledgeSourceToken(input.context.token)) {
      return {
        valid: false,
        issues: [
          {
            path: "context.token",
            message: "Context token must be a well-formed KnowledgeSourceToken",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
