import type { DimensionName } from "./DimensionName.js";

/** Specific, actionable feedback for one dimension (spec "Feedback Generation" — never a generic message). */
export interface Feedback {
  readonly dimension: DimensionName;
  readonly message: string;
}
