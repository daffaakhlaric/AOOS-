import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";
import { isKnowledgeProviderToken } from "../token/knowledge-provider-token.js";

/** Flags a blank or structurally malformed `context.token` (ExecutionToken). */
export class ExecutionTokenValidator implements IKnowledgeProviderValidator {
  readonly name = "executionToken";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    if (!isKnowledgeProviderToken(input.context.token)) {
      return {
        valid: false,
        issues: [
          {
            path: "context.token",
            message: "Context token must be a well-formed KnowledgeProviderToken",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
