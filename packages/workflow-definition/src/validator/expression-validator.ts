import { ExpressionType } from "../contracts/expression-type.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import { collectExpressions, walkExpression } from "./expression-walker.js";
import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

/** Expression Validation (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "VALIDATION"): semantic rules `expressionSchema` cannot express structurally on its own (e.g. a "between" Date Expression needs `rangeEnd`). */
export class ExpressionValidator implements IWorkflowValidator {
  readonly name = "expression";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];

    for (const expression of collectExpressions(workflow)) {
      walkExpression(expression, (node) => {
        if (node.type === ExpressionType.DATE && node.operator === "between" && !node.rangeEnd) {
          issues.push({
            path: "expressions",
            message: '"between" Date Expression requires a rangeEnd operand',
          });
        }
        if (
          node.type === ExpressionType.BOOLEAN &&
          node.operator === "not" &&
          node.operands.length !== 1
        ) {
          issues.push({
            path: "expressions",
            message: `"not" Boolean Expression requires exactly 1 operand, got ${node.operands.length}`,
          });
        }
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
