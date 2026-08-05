import type {
  ExecutionValidationInput,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./i-execution-validator.js";

/** "Node Validator" — exactly one resolvable Start Node and at least one End Node in the runtime graph. */
export class NodeValidator implements IExecutionValidator {
  readonly name = "node";

  validate(input: ExecutionValidationInput): ExecutionValidationResult {
    const issues: ExecutionValidationResult["issues"][number][] = [];

    if (!input.graph.startNodeId || !input.graph.nodeIds.includes(input.graph.startNodeId)) {
      issues.push({ path: "nodes", message: "Workflow Definition has no resolvable Start Node" });
    }
    if (input.graph.endNodeIds.size === 0) {
      issues.push({ path: "nodes", message: "Workflow Definition has no End Node" });
    }

    return { valid: issues.length === 0, issues };
  }
}
