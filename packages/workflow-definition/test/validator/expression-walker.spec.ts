import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import type { Expression } from "../../src/expressions/expression.js";
import { collectExpressions, walkExpression } from "../../src/validator/expression-walker.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("expression-walker", () => {
  describe("collectExpressions", () => {
    it("collects a Condition node's condition", () => {
      const workflow = workflowFixture({
        nodes: [
          { id: "start", name: "S", type: NodeType.START },
          {
            id: "cond",
            name: "C",
            type: NodeType.CONDITION,
            condition: { type: ExpressionType.LITERAL, value: true },
          },
          { id: "end", name: "E", type: NodeType.END },
        ],
        transitions: [],
      });
      expect(collectExpressions(workflow)).toHaveLength(1);
    });

    it("collects every Decision node branch condition", () => {
      const workflow = workflowFixture({
        nodes: [
          { id: "start", name: "S", type: NodeType.START },
          {
            id: "dec",
            name: "D",
            type: NodeType.DECISION,
            branches: [
              { condition: { type: ExpressionType.LITERAL, value: true }, transitionId: "t-a" },
              { condition: { type: ExpressionType.LITERAL, value: false }, transitionId: "t-b" },
            ],
          },
          { id: "end", name: "E", type: NodeType.END },
        ],
        transitions: [],
      });
      expect(collectExpressions(workflow)).toHaveLength(2);
    });

    it("collects a Loop node's loopCondition", () => {
      const workflow = workflowFixture({
        nodes: [
          { id: "start", name: "S", type: NodeType.START },
          {
            id: "loop",
            name: "L",
            type: NodeType.LOOP,
            loopCondition: { type: ExpressionType.LITERAL, value: true },
            bodyNodeId: "body",
          },
          { id: "body", name: "Body", type: NodeType.TASK },
          { id: "end", name: "E", type: NodeType.END },
        ],
        transitions: [
          { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "loop" },
          { id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "loop", toNodeId: "end" },
        ],
      });
      expect(collectExpressions(workflow)).toHaveLength(1);
    });

    it("collects a Wait node's waitCondition when present, and skips it when absent", () => {
      const withCondition = workflowFixture({
        nodes: [
          { id: "start", name: "S", type: NodeType.START },
          {
            id: "wait",
            name: "W",
            type: NodeType.WAIT,
            waitCondition: { type: ExpressionType.LITERAL, value: true },
          },
          { id: "end", name: "E", type: NodeType.END },
        ],
        transitions: [],
      });
      expect(collectExpressions(withCondition)).toHaveLength(1);

      const withoutCondition = workflowFixture({
        nodes: [
          { id: "start", name: "S", type: NodeType.START },
          { id: "wait", name: "W", type: NodeType.WAIT },
          { id: "end", name: "E", type: NodeType.END },
        ],
        transitions: [],
      });
      expect(collectExpressions(withoutCondition)).toHaveLength(0);
    });

    it("collects a Transition's condition expression", () => {
      const workflow = workflowFixture({
        transitions: [
          {
            id: "t-1",
            kind: TransitionKind.CONDITION,
            fromNodeId: "start",
            toNodeId: "task-1",
            condition: { type: ExpressionType.LITERAL, value: true },
          },
        ],
      });
      expect(collectExpressions(workflow)).toHaveLength(1);
    });
  });

  describe("walkExpression", () => {
    it("visits both operands of a Comparison/Arithmetic expression", () => {
      const expression: Expression = {
        type: ExpressionType.ARITHMETIC,
        operator: "add",
        left: { type: ExpressionType.LITERAL, value: 1 },
        right: { type: ExpressionType.LITERAL, value: 2 },
      };
      const visited: Expression[] = [];
      walkExpression(expression, (node) => visited.push(node));
      expect(visited).toHaveLength(3);
    });

    it("visits left, right, and rangeEnd of a Date expression when rangeEnd is present", () => {
      const expression: Expression = {
        type: ExpressionType.DATE,
        operator: "between",
        left: { type: ExpressionType.LITERAL, value: "2026-01-01" },
        right: { type: ExpressionType.LITERAL, value: "2026-01-31" },
        rangeEnd: { type: ExpressionType.LITERAL, value: "2026-02-01" },
      };
      const visited: Expression[] = [];
      walkExpression(expression, (node) => visited.push(node));
      expect(visited).toHaveLength(4);
    });

    it("skips rangeEnd when absent on a Date expression", () => {
      const expression: Expression = {
        type: ExpressionType.DATE,
        operator: "before",
        left: { type: ExpressionType.LITERAL, value: "2026-01-01" },
        right: { type: ExpressionType.LITERAL, value: "2026-01-31" },
      };
      const visited: Expression[] = [];
      walkExpression(expression, (node) => visited.push(node));
      expect(visited).toHaveLength(3);
    });

    it("visits every operand of a Boolean/String expression", () => {
      const expression: Expression = {
        type: ExpressionType.STRING,
        operator: "concat",
        operands: [
          { type: ExpressionType.LITERAL, value: "a" },
          { type: ExpressionType.LITERAL, value: "b" },
        ],
      };
      const visited: Expression[] = [];
      walkExpression(expression, (node) => visited.push(node));
      expect(visited).toHaveLength(3);
    });

    it("visits a leaf expression (Literal/VariableReference/CapabilityReference) exactly once", () => {
      const visited: Expression[] = [];
      walkExpression({ type: ExpressionType.LITERAL, value: 1 }, (node) => visited.push(node));
      walkExpression({ type: ExpressionType.VARIABLE_REFERENCE, variableName: "x" }, (node) =>
        visited.push(node),
      );
      walkExpression({ type: ExpressionType.CAPABILITY_REFERENCE, capabilityId: "cap-1" }, (node) =>
        visited.push(node),
      );
      expect(visited).toHaveLength(3);
    });
  });
});
