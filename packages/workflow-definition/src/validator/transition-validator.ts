import { TransitionKind } from "../contracts/transition-kind.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

/** Transition Validation (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "TRANSITIONS"): `fromNodeId`/`toNodeId` must resolve, and a `condition` Transition must carry a `condition` expression. */
export class TransitionValidator implements IWorkflowValidator {
  readonly name = "transition";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];
    const nodeIds = new Set(workflow.nodes.map((node) => node.id));

    for (const transition of workflow.transitions ?? []) {
      const path = `transitions.${transition.id}`;
      if (!nodeIds.has(transition.fromNodeId)) {
        issues.push({
          path: `${path}.fromNodeId`,
          message: `Unknown node id "${transition.fromNodeId}"`,
        });
      }
      if (!nodeIds.has(transition.toNodeId)) {
        issues.push({
          path: `${path}.toNodeId`,
          message: `Unknown node id "${transition.toNodeId}"`,
        });
      }
      if (transition.kind === TransitionKind.CONDITION && !transition.condition) {
        issues.push({
          path: `${path}.condition`,
          message: 'a "condition" Transition must declare a condition expression',
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
