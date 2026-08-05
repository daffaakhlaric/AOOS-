import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

/**
 * "Duplicate Adapter" — `WorkflowIntegrationRegistry#register()` already rejects a
 * duplicate namespace + name + version at insert time, so the only observable
 * "duplicate" shape left to flag here is the same Adapter `name` reused across two
 * *different* namespaces — usually a copy-paste registration bug, not a deliberate
 * design.
 */
export class DuplicateAdapterValidator implements IIntegrationValidatorStage {
  readonly name = "duplicate-adapter";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];
    const namespacesByName = new Map<string, Set<string>>();

    for (const namespace of input.registry.listNamespaces()) {
      for (const adapter of input.registry.list(namespace)) {
        const namespaces = namespacesByName.get(adapter.name) ?? new Set<string>();
        namespaces.add(adapter.namespace);
        namespacesByName.set(adapter.name, namespaces);
      }
    }

    for (const [name, namespaces] of namespacesByName) {
      if (namespaces.size > 1) {
        issues.push({
          path: `adapters.${name}`,
          message: `Adapter name "${name}" is reused across multiple namespaces: ${Array.from(namespaces).join(", ")}`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
