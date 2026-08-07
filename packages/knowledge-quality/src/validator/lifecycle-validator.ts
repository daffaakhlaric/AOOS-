import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";
import { KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS } from "../domain/knowledge-quality-assessment-state.js";

/** Stage 8 — Lifecycle: read-only check that `currentState` -> `targetState` is a legal edge in the transition table. */
export class LifecycleValidator implements IKnowledgeQualityValidator {
  readonly name = "lifecycle";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (
      input.currentState !== undefined &&
      input.targetState !== undefined &&
      input.currentState !== input.targetState &&
      !KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[input.currentState].includes(
        input.targetState,
      )
    ) {
      issues.push({
        path: "targetState",
        message: `Illegal transition "${input.currentState}" -> "${input.targetState}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
