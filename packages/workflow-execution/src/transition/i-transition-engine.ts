import type { ExecutionCursor } from "../cursor/execution-cursor.js";
import type { ExecutionGraph } from "../graph/execution-graph.js";

import type { TransitionOutcome } from "./transition-outcome.js";

export interface ResolveTransitionInput {
  readonly graph: ExecutionGraph;
  readonly cursor: ExecutionCursor;
  readonly outcome: TransitionOutcome;
  readonly maxLoopIterations?: number;
}

export interface ResolvedTransition {
  readonly nextNodeIds: readonly string[];
  readonly isLoopBack: boolean;
}

export interface ITransitionEngine {
  resolve(input: ResolveTransitionInput): ResolvedTransition;
}
