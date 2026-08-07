import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";
import { KnowledgeValidationDecisionValue } from "../domain/knowledge-validation-decision-value.js";

const VALID_DECISION_VALUES = new Set<string>(Object.values(KnowledgeValidationDecisionValue));

/**
 * Stage 6 — Decision: when a `KnowledgeValidationDecision` has already been recorded on
 * this Validation, checks its `value` is one of the 6 legal Validation Decision values
 * and that `confidence` (when present) is a valid 0-1 ratio. When no Decision has been
 * recorded yet, this stage is a documented no-op — same spirit as
 * `@aos/knowledge-generator`'s "structural no-op" stages.
 */
export class DecisionValidator implements IKnowledgeValidatorStage {
  readonly name = "decision";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    const decision = input.decision;
    if (decision) {
      if (!VALID_DECISION_VALUES.has(decision.value)) {
        issues.push({
          path: "decision.value",
          message: "Decision value must be a known Validation Decision value",
        });
      }
      if (
        decision.confidence !== undefined &&
        (decision.confidence < 0 || decision.confidence > 1)
      ) {
        issues.push({
          path: "decision.confidence",
          message: "Decision confidence must be between 0 and 1",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
