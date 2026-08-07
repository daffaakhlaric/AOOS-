import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";
import { EMBEDDING_STATE_TRANSITIONS } from "../domain/embedding-state.js";

/** Stage 8 — Lifecycle: when both `currentState` and `targetState` are supplied, the transition must be legal per the 9-state transition table. */
export class LifecycleValidator implements IEmbeddingValidatorStage {
  readonly name = "lifecycle";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (
      input.currentState !== undefined &&
      input.targetState !== undefined &&
      input.currentState !== input.targetState &&
      !EMBEDDING_STATE_TRANSITIONS[input.currentState].includes(input.targetState)
    ) {
      issues.push({
        path: "targetState",
        message: `Illegal transition "${input.currentState}" -> "${input.targetState}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
