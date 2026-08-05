import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural-only Input/Output validation — no per-type IO schema exists yet (that is Execution Engine territory, 005.6D); this only guards `NodeContext.input`/`output` are plain objects when present. */
export class InputOutputValidator implements INodeValidator {
  readonly name = "input-output";

  validate(execution: NodeExecution): NodeValidationResult {
    const issues: { path: string; message: string }[] = [];
    if (execution.context.input !== undefined && !isPlainObject(execution.context.input)) {
      issues.push({
        path: "input",
        message: "Node Context input must be a plain object when present",
      });
    }
    if (execution.context.output !== undefined && !isPlainObject(execution.context.output)) {
      issues.push({
        path: "output",
        message: "Node Context output must be a plain object when present",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
