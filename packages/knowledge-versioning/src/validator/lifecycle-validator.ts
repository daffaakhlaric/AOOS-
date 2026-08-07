import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { KNOWLEDGE_VERSION_STATE_TRANSITIONS } from "../domain/knowledge-version-state.js";

/** Stage 4 — Lifecycle: when a `currentState`/`targetState` pair is supplied, the transition must be present in the authoritative transition table. */
export class LifecycleValidator implements IKnowledgeVersionValidator {
  readonly name = "lifecycle";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    if (input.currentState === undefined || input.targetState === undefined) {
      return { valid: true, issues: [] };
    }
    if (!KNOWLEDGE_VERSION_STATE_TRANSITIONS[input.currentState].includes(input.targetState)) {
      return {
        valid: false,
        issues: [
          {
            path: "targetState",
            message: `Lifecycle transition "${input.currentState}" -> "${input.targetState}" is not legal`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
