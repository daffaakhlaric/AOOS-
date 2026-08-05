import type { TransitionOutcome } from "../transition/transition-outcome.js";

/** The internal outcome of running exactly one Node through `@aos/node-runtime` — never exposed outside `engine/`. */
export interface NodeStepResult {
  readonly outcome: TransitionOutcome;
  readonly reason?: string;
}
