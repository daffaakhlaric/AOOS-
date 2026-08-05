import type {
  ExecutionValidationInput,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./i-execution-validator.js";

/** "Transition Validator" — every Transition's endpoints resolve to a known Node id in the runtime graph. */
export class TransitionValidator implements IExecutionValidator {
  readonly name = "transition";

  validate(input: ExecutionValidationInput): ExecutionValidationResult {
    const issues: ExecutionValidationResult["issues"][number][] = [];
    const knownNodeIds = new Set(input.graph.nodeIds);

    for (const [fromNodeId, edges] of input.graph.edgesByFromNode) {
      if (!knownNodeIds.has(fromNodeId)) {
        issues.push({
          path: `transitions`,
          message: `Transition references unknown fromNodeId "${fromNodeId}"`,
        });
      }
      for (const edge of edges) {
        if (!knownNodeIds.has(edge.toNodeId)) {
          issues.push({
            path: `transitions.${edge.transitionId}`,
            message: `Transition "${edge.transitionId}" references unknown toNodeId "${edge.toNodeId}"`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
