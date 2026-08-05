import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

/** "Missing Runtime" — flags every registered Adapter whose `isAvailable()` reports `false` (no underlying future-runtime contract was injected). */
export class MissingRuntimeValidator implements IIntegrationValidatorStage {
  readonly name = "missing-runtime";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];

    for (const namespace of input.registry.listNamespaces()) {
      for (const adapter of input.registry.list(namespace)) {
        if (!adapter.isAvailable()) {
          issues.push({
            path: `adapters.${adapter.name}.runtime`,
            message: `Adapter "${adapter.name}" (namespace "${adapter.namespace}") has no underlying runtime configured`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
