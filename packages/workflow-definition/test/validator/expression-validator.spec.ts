import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { ExpressionValidator } from "../../src/validator/expression-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Expression Validation Test — ExpressionValidator", () => {
  it("passes a workflow with no expressions", () => {
    expect(new ExpressionValidator().validate(workflowFixture()).valid).toBe(true);
  });

  it("fails a 'between' Date expression with no rangeEnd", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: {
            type: ExpressionType.DATE,
            operator: "between",
            left: { type: ExpressionType.LITERAL, value: "2026-01-01" },
            right: { type: ExpressionType.LITERAL, value: "2026-01-31" },
          },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    const result = new ExpressionValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("rangeEnd");
  });

  it("passes a 'between' Date expression with rangeEnd set", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: {
            type: ExpressionType.DATE,
            operator: "between",
            left: { type: ExpressionType.LITERAL, value: "2026-01-01" },
            right: { type: ExpressionType.LITERAL, value: "2026-01-31" },
            rangeEnd: { type: ExpressionType.LITERAL, value: "2026-02-01" },
          },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    expect(new ExpressionValidator().validate(workflow).valid).toBe(true);
  });

  it("fails a 'not' Boolean expression with more than 1 operand", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: {
            type: ExpressionType.BOOLEAN,
            operator: "not",
            operands: [
              { type: ExpressionType.LITERAL, value: true },
              { type: ExpressionType.LITERAL, value: false },
            ],
          },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    const result = new ExpressionValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain('"not"');
  });

  it("passes a 'not' Boolean expression with exactly 1 operand", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: {
            type: ExpressionType.BOOLEAN,
            operator: "not",
            operands: [{ type: ExpressionType.LITERAL, value: true }],
          },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    expect(new ExpressionValidator().validate(workflow).valid).toBe(true);
  });
});
