import type { DimensionName } from "./DimensionName.js";

/** A forward-looking, prioritized suggestion for how to raise one dimension's score next iteration. */
export interface ImprovementSuggestion {
  readonly dimension: DimensionName;
  readonly priority: "HIGH" | "MEDIUM" | "LOW";
  readonly suggestion: string;
}
