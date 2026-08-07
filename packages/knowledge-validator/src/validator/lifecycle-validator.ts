import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";
import { KNOWLEDGE_VALIDATION_STATE_TRANSITIONS } from "../domain/knowledge-validation-state.js";

/** Stage 8 — Lifecycle: read-only check that `currentState` -> `targetState` is a legal edge in the transition table. */
export class LifecycleValidator implements IKnowledgeValidatorStage {
  readonly name = "lifecycle";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (
      input.currentState !== undefined &&
      input.targetState !== undefined &&
      input.currentState !== input.targetState &&
      !KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[input.currentState].includes(input.targetState)
    ) {
      issues.push({
        path: "targetState",
        message: `Illegal transition "${input.currentState}" -> "${input.targetState}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
