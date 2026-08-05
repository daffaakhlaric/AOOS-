import type { NodeExecution } from "../instance/node-execution.js";

import { CompatibilityValidator } from "./compatibility-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";
import { InputOutputValidator } from "./input-output-validator.js";
import { SchemaValidator } from "./schema-validator.js";
import { VersionValidator } from "./version-validator.js";

/**
 * "NODE VALIDATION: Schema, Configuration, Compatibility, Input, Output, Dependency,
 * Version." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md). Runs every stage in order,
 * aggregating all issues (does not short-circuit).
 */
export class ValidationPipeline {
  private readonly validators: readonly INodeValidator[];

  constructor(extraValidators: readonly INodeValidator[] = []) {
    this.validators = [
      new SchemaValidator(),
      new ConfigurationValidator(),
      new CompatibilityValidator(),
      new InputOutputValidator(),
      new DependencyValidator(),
      new VersionValidator(),
      ...extraValidators,
    ];
  }

  run(execution: NodeExecution): NodeValidationResult {
    const issues: NodeValidationResult["issues"][number][] = [];
    for (const validator of this.validators) {
      const result = validator.validate(execution);
      issues.push(...result.issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
