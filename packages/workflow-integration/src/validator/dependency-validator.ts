import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

/** "Dependency" — every name listed as a dependency in `input.dependencies` must itself be a registered Adapter name somewhere in the Registry. */
export class DependencyValidator implements IIntegrationValidatorStage {
  readonly name = "dependency";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];
    const dependencies = input.dependencies ?? {};
    const knownNames = new Set(
      input.registry
        .listNamespaces()
        .flatMap((namespace) => input.registry.list(namespace).map((adapter) => adapter.name)),
    );

    for (const [name, deps] of Object.entries(dependencies)) {
      for (const dependency of deps) {
        if (!knownNames.has(dependency)) {
          issues.push({
            path: `dependencies.${name}`,
            message: `Adapter "${name}" declares a dependency on unknown Adapter "${dependency}"`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
