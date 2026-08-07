import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";
import { KNOWLEDGE_POLICY_STATE_TRANSITIONS } from "../domain/knowledge-policy-state.js";

/** Stage 10 — Integrity: overall consistency — lifecycle transition legality. */
export class IntegrityValidator implements IKnowledgePolicyValidator {
  readonly name = "integrity";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.currentState !== undefined && input.targetState !== undefined) {
      const allowed = KNOWLEDGE_POLICY_STATE_TRANSITIONS[input.currentState];
      if (!allowed.includes(input.targetState)) {
        issues.push({
          path: "lifecycle",
          message: `Transition from "${input.currentState}" to "${input.targetState}" is not allowed`,
        });
      }
    }
    if (input.metadata.createdAt > input.metadata.updatedAt) {
      issues.push({ path: "metadata.createdAt", message: "createdAt must not be after updatedAt" });
    }
    return { valid: issues.length === 0, issues };
  }
}
