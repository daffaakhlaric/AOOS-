import { CircularIntegrationValidator } from "./circular-integration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { DuplicateAdapterValidator } from "./duplicate-adapter-validator.js";
import { EnvironmentValidator } from "./environment-validator.js";
import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";
import { MissingRuntimeValidator } from "./missing-runtime-validator.js";
import { NamespaceValidator } from "./namespace-validator.js";
import { TenantValidator } from "./tenant-validator.js";
import { VersionValidator } from "./version-validator.js";

/**
 * "INTEGRATION VALIDATOR: Duplicate Adapter, Namespace, Version, Circular Integration,
 * Missing Runtime, Tenant, Environment, Dependency." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md).
 * Runs all 8 stages in order, aggregating every issue — never short-circuits.
 */
export class WorkflowIntegrationValidator {
  private readonly stages: readonly IIntegrationValidatorStage[];

  constructor(extraStages: readonly IIntegrationValidatorStage[] = []) {
    this.stages = [
      new DuplicateAdapterValidator(),
      new NamespaceValidator(),
      new VersionValidator(),
      new CircularIntegrationValidator(),
      new MissingRuntimeValidator(),
      new TenantValidator(),
      new EnvironmentValidator(),
      new DependencyValidator(),
      ...extraStages,
    ];
  }

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];
    for (const stage of this.stages) {
      issues.push(...stage.validate(input).issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
