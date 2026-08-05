import { isKnowledgeRuntimeToken } from "../token/knowledge-runtime-token.js";

import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags an `instance.token` that is not a structurally valid `KnowledgeRuntimeToken`. */
export class ExecutionTokenValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "executionToken";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { token } = input.execution.instance;
    if (!isKnowledgeRuntimeToken(token)) {
      return {
        valid: false,
        issues: [
          { path: "instance.token", message: `"${token}" is not a valid KnowledgeRuntimeToken` },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
