import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";
import { KNOWLEDGE_GENERATION_STATE_TRANSITIONS } from "../domain/knowledge-generation-state.js";

/** Stage 9 — Lifecycle: read-only check that `currentState` -> `targetState` is a legal edge in the transition table. */
export class LifecycleValidator implements IKnowledgeGeneratorValidator {
  readonly name = "lifecycle";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (
      input.currentState !== undefined &&
      input.targetState !== undefined &&
      input.currentState !== input.targetState &&
      !KNOWLEDGE_GENERATION_STATE_TRANSITIONS[input.currentState].includes(input.targetState)
    ) {
      issues.push({
        path: "targetState",
        message: `Illegal transition "${input.currentState}" -> "${input.targetState}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
