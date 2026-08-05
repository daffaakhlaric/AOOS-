import { ExpressionType } from "../contracts/expression-type.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import { collectExpressions, walkExpression } from "./expression-walker.js";
import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

/** Variable Validation (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "VARIABLES"): every `VariableReferenceExpression` must resolve to a Variable declared somewhere in the Workflow (Workflow-level or any Node-level declaration). */
export class VariableValidator implements IWorkflowValidator {
  readonly name = "variable";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];

    const declaredNames = new Set<string>();
    for (const variable of workflow.variables ?? []) {
      declaredNames.add(variable.name);
    }
    for (const node of workflow.nodes) {
      for (const variable of node.variables ?? []) {
        declaredNames.add(variable.name);
      }
    }

    for (const expression of collectExpressions(workflow)) {
      walkExpression(expression, (node) => {
        if (
          node.type === ExpressionType.VARIABLE_REFERENCE &&
          !declaredNames.has(node.variableName)
        ) {
          issues.push({
            path: "variables",
            message: `Undeclared variable reference "${node.variableName}"`,
          });
        }
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
