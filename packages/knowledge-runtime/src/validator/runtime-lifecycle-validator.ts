import { KNOWLEDGE_RUNTIME_TERMINAL_STATE } from "../domain/knowledge-runtime-state.js";

import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags an attempt to run any Runtime operation against an Instance already `DESTROYED` — the one true terminal state. */
export class RuntimeLifecycleValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "lifecycle";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    if (input.execution.instance.state === KNOWLEDGE_RUNTIME_TERMINAL_STATE) {
      return {
        valid: false,
        issues: [
          {
            path: "instance.state",
            message: `Instance "${input.execution.instance.token}" is already DESTROYED — no further operations are legal`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
