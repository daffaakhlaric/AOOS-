import {
  detectDeadEnds,
  detectInfiniteLoopRisks,
  detectOrphanNodes,
} from "../graph/graph-analyzer.js";

import type {
  ExecutionValidationInput,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./i-execution-validator.js";

/** "Graph Validator" — dead ends, orphan Nodes, and unintended infinite loop risk. */
export class GraphValidator implements IExecutionValidator {
  readonly name = "graph";

  validate(input: ExecutionValidationInput): ExecutionValidationResult {
    const issues: ExecutionValidationResult["issues"][number][] = [];

    for (const nodeId of detectDeadEnds(input.graph)) {
      issues.push({
        path: `nodes.${nodeId}`,
        message: `Node "${nodeId}" is a dead end (no outgoing Transition and not an End Node)`,
      });
    }
    for (const nodeId of detectOrphanNodes(input.graph)) {
      issues.push({
        path: `nodes.${nodeId}`,
        message: `Node "${nodeId}" is orphaned (no incoming Transition and not the Start Node)`,
      });
    }
    for (const cycle of detectInfiniteLoopRisks(input.graph)) {
      issues.push({
        path: "graph",
        message: `Unintended infinite loop risk: ${cycle.join(" -> ")}`,
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
