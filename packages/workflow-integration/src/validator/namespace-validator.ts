import { IntegrationNamespace } from "../contracts/integration-namespace.js";

import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

const KNOWN_NAMESPACES: ReadonlySet<string> = new Set(Object.values(IntegrationNamespace));

/** "Namespace" — every registered Adapter's `namespace` must be one of the 9 known `IntegrationNamespace` values. */
export class NamespaceValidator implements IIntegrationValidatorStage {
  readonly name = "namespace";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];

    for (const namespace of input.registry.listNamespaces()) {
      for (const adapter of input.registry.list(namespace)) {
        if (!KNOWN_NAMESPACES.has(adapter.namespace)) {
          issues.push({
            path: `adapters.${adapter.name}.namespace`,
            message: `Adapter "${adapter.name}" declares an unknown namespace "${adapter.namespace}"`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
