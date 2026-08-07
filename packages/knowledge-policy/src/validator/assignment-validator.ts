import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 6 — Assignment: assignment count within limits. */
export class AssignmentValidator implements IKnowledgePolicyValidator {
  readonly name = "assignment";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.assignmentCount !== undefined && input.configuration.maxAssignments !== undefined) {
      if (input.assignmentCount > input.configuration.maxAssignments) {
        issues.push({
          path: "assignments",
          message: `Assignment count ${String(input.assignmentCount)} exceeds maxAssignments ${String(input.configuration.maxAssignments)}`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
