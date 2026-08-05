import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";

/** Confirms the resolved `NodeManifest` actually matches the persisted `NodeInstance.type` — a defensive consistency check against manifest/registry drift. */
export class CompatibilityValidator implements INodeValidator {
  readonly name = "compatibility";

  validate(execution: NodeExecution): NodeValidationResult {
    if (execution.manifest.type !== execution.instance.type) {
      return {
        valid: false,
        issues: [
          {
            path: "type",
            message: `Node Instance type "${execution.instance.type}" does not match resolved Manifest type "${execution.manifest.type}"`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
