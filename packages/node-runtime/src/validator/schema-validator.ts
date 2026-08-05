import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";

/** Validates `NodeInstance.config` against the Manifest's `configSchema` (when one is registered — `Script` has none, "interface only"). */
export class SchemaValidator implements INodeValidator {
  readonly name = "schema";

  validate(execution: NodeExecution): NodeValidationResult {
    const { configSchema } = execution.manifest;
    if (!configSchema) {
      return { valid: true, issues: [] };
    }
    const result = configSchema.safeParse(execution.instance.config);
    if (result.success) {
      return { valid: true, issues: [] };
    }
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        path: `config.${issue.path.join(".") || "(root)"}`,
        message: issue.message,
      })),
    };
  }
}
