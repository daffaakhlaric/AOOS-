import { ExpressionType } from "../contracts/expression-type.js";
import { NodeType } from "../contracts/node-type.js";
import type { Expression } from "../expressions/expression.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

/** Every top-level Expression referenced anywhere in a Workflow Definition (Node conditions/branches/loop/wait, Transition conditions). */
export function collectExpressions(workflow: WorkflowDefinition): Expression[] {
  const expressions: Expression[] = [];

  for (const node of workflow.nodes) {
    if (node.type === NodeType.CONDITION) {
      expressions.push(node.condition);
    }
    if (node.type === NodeType.DECISION) {
      for (const branch of node.branches) {
        expressions.push(branch.condition);
      }
    }
    if (node.type === NodeType.LOOP) {
      expressions.push(node.loopCondition);
    }
    if (node.type === NodeType.WAIT && node.waitCondition) {
      expressions.push(node.waitCondition);
    }
  }

  for (const transition of workflow.transitions ?? []) {
    if (transition.condition) {
      expressions.push(transition.condition);
    }
  }

  return expressions;
}

/** Recursively walks an Expression tree, calling `visit` on every node (including nested operands). */
export function walkExpression(expression: Expression, visit: (node: Expression) => void): void {
  visit(expression);
  switch (expression.type) {
    case ExpressionType.COMPARISON:
    case ExpressionType.ARITHMETIC:
      walkExpression(expression.left, visit);
      walkExpression(expression.right, visit);
      return;
    case ExpressionType.DATE:
      walkExpression(expression.left, visit);
      walkExpression(expression.right, visit);
      if (expression.rangeEnd) {
        walkExpression(expression.rangeEnd, visit);
      }
      return;
    case ExpressionType.BOOLEAN:
    case ExpressionType.STRING:
      for (const operand of expression.operands) {
        walkExpression(operand, visit);
      }
      return;
    case ExpressionType.LITERAL:
    case ExpressionType.VARIABLE_REFERENCE:
    case ExpressionType.CAPABILITY_REFERENCE:
      return;
  }
}
