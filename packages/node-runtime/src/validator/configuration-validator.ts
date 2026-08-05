import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";

/** A Node Type registered with no `configSchema` (e.g. `Script` — "interface only") must not carry a non-empty `config` — there is nothing valid to configure. */
export class ConfigurationValidator implements INodeValidator {
  readonly name = "configuration";

  validate(execution: NodeExecution): NodeValidationResult {
    if (execution.manifest.configSchema) {
      return { valid: true, issues: [] };
    }
    if (Object.keys(execution.instance.config).length > 0) {
      return {
        valid: false,
        issues: [
          {
            path: "config",
            message: `Node Type "${execution.manifest.type}" has no configSchema — "config" must be empty`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
