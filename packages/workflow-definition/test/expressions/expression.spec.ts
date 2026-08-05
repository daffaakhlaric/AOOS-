import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { expressionSchema } from "../../src/expressions/expression.js";

describe("Schema Test — expressionSchema (Expression Engine)", () => {
  it("accepts a Literal expression", () => {
    expect(expressionSchema.safeParse({ type: ExpressionType.LITERAL, value: 42 }).success).toBe(
      true,
    );
    expect(expressionSchema.safeParse({ type: ExpressionType.LITERAL, value: null }).success).toBe(
      true,
    );
  });

  it("accepts a Variable reference expression", () => {
    expect(
      expressionSchema.safeParse({ type: ExpressionType.VARIABLE_REFERENCE, variableName: "x" })
        .success,
    ).toBe(true);
  });

  it("accepts a Capability reference expression", () => {
    expect(
      expressionSchema.safeParse({
        type: ExpressionType.CAPABILITY_REFERENCE,
        capabilityId: "inventory.read",
      }).success,
    ).toBe(true);
  });

  it("accepts a Comparison expression with nested operands", () => {
    const result = expressionSchema.safeParse({
      type: ExpressionType.COMPARISON,
      operator: "gt",
      left: { type: ExpressionType.VARIABLE_REFERENCE, variableName: "score" },
      right: { type: ExpressionType.LITERAL, value: 90 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Boolean expression with multiple operands", () => {
    const result = expressionSchema.safeParse({
      type: ExpressionType.BOOLEAN,
      operator: "and",
      operands: [
        { type: ExpressionType.LITERAL, value: true },
        { type: ExpressionType.LITERAL, value: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a Boolean expression with zero operands", () => {
    expect(
      expressionSchema.safeParse({ type: ExpressionType.BOOLEAN, operator: "and", operands: [] })
        .success,
    ).toBe(false);
  });

  it("accepts an Arithmetic expression", () => {
    const result = expressionSchema.safeParse({
      type: ExpressionType.ARITHMETIC,
      operator: "add",
      left: { type: ExpressionType.LITERAL, value: 1 },
      right: { type: ExpressionType.LITERAL, value: 2 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a String expression", () => {
    const result = expressionSchema.safeParse({
      type: ExpressionType.STRING,
      operator: "concat",
      operands: [
        { type: ExpressionType.LITERAL, value: "a" },
        { type: ExpressionType.LITERAL, value: "b" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Date expression, including a 'between' with rangeEnd", () => {
    const result = expressionSchema.safeParse({
      type: ExpressionType.DATE,
      operator: "between",
      left: { type: ExpressionType.LITERAL, value: "2026-01-01" },
      right: { type: ExpressionType.LITERAL, value: "2026-01-31" },
      rangeEnd: { type: ExpressionType.LITERAL, value: "2026-02-01" },
    });
    expect(result.success).toBe(true);
  });

  it("supports deep nesting (Comparison inside Boolean inside Boolean)", () => {
    const result = expressionSchema.safeParse({
      type: ExpressionType.BOOLEAN,
      operator: "or",
      operands: [
        {
          type: ExpressionType.BOOLEAN,
          operator: "not",
          operands: [
            {
              type: ExpressionType.COMPARISON,
              operator: "eq",
              left: { type: ExpressionType.VARIABLE_REFERENCE, variableName: "status" },
              right: { type: ExpressionType.LITERAL, value: "done" },
            },
          ],
        },
        { type: ExpressionType.LITERAL, value: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown expression type", () => {
    expect(expressionSchema.safeParse({ type: "bogus" }).success).toBe(false);
  });
});
