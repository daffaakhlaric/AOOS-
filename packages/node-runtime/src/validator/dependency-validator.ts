import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";

/** Rejects a self-referencing `dependsOn` entry — a Node cannot depend on itself. Full multi-node dependency-cycle detection belongs to the Workflow Definition's own `CycleValidator` (`@aos/workflow-definition`); this is a local, single-Node sanity check. */
export class DependencyValidator implements INodeValidator {
  readonly name = "dependency";

  validate(execution: NodeExecution): NodeValidationResult {
    const dependsOn = execution.instance.dependsOn ?? [];
    if (dependsOn.includes(execution.instance.nodeId)) {
      return {
        valid: false,
        issues: [
          {
            path: "dependsOn",
            message: `Node "${execution.instance.nodeId}" cannot depend on itself`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
