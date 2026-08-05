import { NodeType } from "../contracts/node-type.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

function findCycles(edges: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (id: string): void => {
    if (onStack.has(id)) {
      const cycleStart = stack.indexOf(id);
      cycles.push([...stack.slice(cycleStart), id]);
      return;
    }
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    stack.push(id);
    onStack.add(id);
    for (const next of edges.get(id) ?? []) {
      visit(next);
    }
    stack.pop();
    onStack.delete(id);
  };

  for (const id of edges.keys()) {
    visit(id);
  }
  return cycles;
}

/**
 * Cycle Detection + Loop Detection (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md —
 * "VALIDATION"). Builds the Transition graph (`fromNodeId` → `toNodeId`) and finds every
 * cycle via DFS. A cycle that passes through a `LoopNode` is an intentional Loop — allowed
 * (Loop Detection). Any other cycle is an unintended graph cycle — rejected (Cycle
 * Detection).
 */
export class CycleValidator implements IWorkflowValidator {
  readonly name = "cycle";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];
    const nodeTypeById = new Map(workflow.nodes.map((node) => [node.id, node.type]));

    const edges = new Map<string, string[]>();
    for (const node of workflow.nodes) {
      edges.set(node.id, []);
    }
    for (const transition of workflow.transitions ?? []) {
      edges.get(transition.fromNodeId)?.push(transition.toNodeId);
    }
    // A Loop node's body is itself an edge back into the loop — model it explicitly so the
    // cycle it forms is detected and can be recognized as intentional.
    for (const node of workflow.nodes) {
      if (node.type === NodeType.LOOP) {
        edges.get(node.id)?.push(node.bodyNodeId);
        edges.get(node.bodyNodeId)?.push(node.id);
      }
    }

    const cycles = findCycles(edges);
    for (const cycle of cycles) {
      const isIntentionalLoop = cycle.some((nodeId) => nodeTypeById.get(nodeId) === NodeType.LOOP);
      if (!isIntentionalLoop) {
        issues.push({
          path: "transitions",
          message: `Unintended cycle detected: ${cycle.join(" → ")}`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
