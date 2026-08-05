import { isKnowledgeSynchronizationToken } from "../token/knowledge-synchronization-token.js";

import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank or structurally malformed `context.token` (ExecutionToken). */
export class ExecutionTokenValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "executionToken";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    if (!isKnowledgeSynchronizationToken(input.context.token)) {
      return {
        valid: false,
        issues: [
          {
            path: "context.token",
            message: "Context token must be a well-formed KnowledgeSynchronizationToken",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
