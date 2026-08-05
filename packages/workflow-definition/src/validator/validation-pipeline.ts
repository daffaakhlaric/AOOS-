import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import { CycleValidator } from "./cycle-validator.js";
import { DuplicateValidator } from "./duplicate-validator.js";
import { ExpressionValidator } from "./expression-validator.js";
import type { IWorkflowValidator, ValidationResult } from "./i-workflow-validator.js";
import { PermissionValidator } from "./permission-validator.js";
import { StructuralValidator } from "./structural-validator.js";
import { TransitionValidator } from "./transition-validator.js";
import { VariableValidator } from "./variable-validator.js";
import { VersionValidator } from "./version-validator.js";

/**
 * Runs Structural → Transition → Duplicate → Cycle → Variable → Expression → Version →
 * Permission in order, aggregating every issue (does not short-circuit). Assumes
 * `workflow` has already passed `workflowDefinitionSchema` (shape validation) — this
 * pipeline checks the structural/semantic rules the schema alone cannot express.
 */
export class ValidationPipeline {
  private readonly validators: readonly IWorkflowValidator[];

  constructor(extraValidators: readonly IWorkflowValidator[] = []) {
    this.validators = [
      new StructuralValidator(),
      new TransitionValidator(),
      new DuplicateValidator(),
      new CycleValidator(),
      new VariableValidator(),
      new ExpressionValidator(),
      new VersionValidator(),
      new PermissionValidator(),
      ...extraValidators,
    ];
  }

  run(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationResult["issues"][number][] = [];
    for (const validator of this.validators) {
      const result = validator.validate(workflow);
      issues.push(...result.issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
