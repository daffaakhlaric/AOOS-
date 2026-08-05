/** Expression kinds the Expression Engine's interfaces model (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "EXPRESSION ENGINE"). Interface only — no evaluator ships in this package. */
export enum ExpressionType {
  LITERAL = "literal",
  COMPARISON = "comparison",
  BOOLEAN = "boolean",
  ARITHMETIC = "arithmetic",
  STRING = "string",
  DATE = "date",
  VARIABLE_REFERENCE = "variable_reference",
  CAPABILITY_REFERENCE = "capability_reference",
}
