import { z } from "zod";

import { ExpressionType } from "../contracts/expression-type.js";

import {
  capabilityReferenceExpressionSchema,
  type CapabilityReferenceExpression,
} from "./capability-reference-expression.js";
import { literalExpressionSchema, type LiteralExpression } from "./literal-expression.js";
import {
  variableReferenceExpressionSchema,
  type VariableReferenceExpression,
} from "./variable-reference-expression.js";

/**
 * The Expression Engine's interfaces (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md
 * — "EXPRESSION ENGINE": Comparison/Boolean/Arithmetic/String/Date/Variable reference/
 * Capability reference). "Design expression interfaces only. No execution." — this file
 * defines the recursive tree shape and validates it structurally; nothing in this package
 * evaluates an Expression against real values.
 *
 * The `Expression` union is declared as plain TypeScript interfaces (not `z.infer<...>`)
 * because a type inferred from its own recursive schema cannot be expressed in
 * TypeScript. Every recursive field (`left`/`right`/`operands`/`rangeEnd`) uses
 * `z.lazy((): z.ZodType<Expression> => expressionSchema)` — an explicitly-typed callback
 * return, the standard way to break the value/type circularity a self-referential Zod
 * schema otherwise creates.
 */
export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
export interface ComparisonExpression {
  readonly type: ExpressionType.COMPARISON;
  readonly operator: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type BooleanOperator = "and" | "or" | "not";
export interface BooleanExpression {
  readonly type: ExpressionType.BOOLEAN;
  readonly operator: BooleanOperator;
  readonly operands: readonly Expression[];
}

export type ArithmeticOperator = "add" | "subtract" | "multiply" | "divide" | "modulo";
export interface ArithmeticExpression {
  readonly type: ExpressionType.ARITHMETIC;
  readonly operator: ArithmeticOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type StringOperator = "concat" | "contains" | "startsWith" | "endsWith";
export interface StringExpression {
  readonly type: ExpressionType.STRING;
  readonly operator: StringOperator;
  readonly operands: readonly Expression[];
}

export type DateOperator = "before" | "after" | "between";
export interface DateExpression {
  readonly type: ExpressionType.DATE;
  readonly operator: DateOperator;
  readonly left: Expression;
  readonly right: Expression;
  /** Required only when `operator` is "between". */
  readonly rangeEnd?: Expression;
}

export type Expression =
  | LiteralExpression
  | VariableReferenceExpression
  | CapabilityReferenceExpression
  | ComparisonExpression
  | BooleanExpression
  | ArithmeticExpression
  | StringExpression
  | DateExpression;

function lazyExpression(): z.ZodType<Expression> {
  return expressionSchema;
}

const comparisonOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]);
const booleanOperatorSchema = z.enum(["and", "or", "not"]);
const arithmeticOperatorSchema = z.enum(["add", "subtract", "multiply", "divide", "modulo"]);
const stringOperatorSchema = z.enum(["concat", "contains", "startsWith", "endsWith"]);
const dateOperatorSchema = z.enum(["before", "after", "between"]);

export const comparisonExpressionSchema = z.object({
  type: z.literal(ExpressionType.COMPARISON),
  operator: comparisonOperatorSchema,
  left: z.lazy(lazyExpression),
  right: z.lazy(lazyExpression),
});

export const booleanExpressionSchema = z.object({
  type: z.literal(ExpressionType.BOOLEAN),
  operator: booleanOperatorSchema,
  operands: z.array(z.lazy(lazyExpression)).min(1),
});

export const arithmeticExpressionSchema = z.object({
  type: z.literal(ExpressionType.ARITHMETIC),
  operator: arithmeticOperatorSchema,
  left: z.lazy(lazyExpression),
  right: z.lazy(lazyExpression),
});

export const stringExpressionSchema = z.object({
  type: z.literal(ExpressionType.STRING),
  operator: stringOperatorSchema,
  operands: z.array(z.lazy(lazyExpression)).min(1),
});

export const dateExpressionSchema = z.object({
  type: z.literal(ExpressionType.DATE),
  operator: dateOperatorSchema,
  left: z.lazy(lazyExpression),
  right: z.lazy(lazyExpression),
  rangeEnd: z.lazy(lazyExpression).optional(),
});

export const expressionSchema: z.ZodType<Expression> = z.discriminatedUnion("type", [
  literalExpressionSchema,
  variableReferenceExpressionSchema,
  capabilityReferenceExpressionSchema,
  comparisonExpressionSchema,
  booleanExpressionSchema,
  arithmeticExpressionSchema,
  stringExpressionSchema,
  dateExpressionSchema,
]);
