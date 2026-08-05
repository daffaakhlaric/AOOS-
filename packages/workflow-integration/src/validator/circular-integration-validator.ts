import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

/** "Circular Integration" — DFS cycle detection over `input.dependencies` (Adapter name → the names of Adapters it depends on). */
export class CircularIntegrationValidator implements IIntegrationValidatorStage {
  readonly name = "circular-integration";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];
    const dependencies = input.dependencies ?? {};
    const visited = new Set<string>();
    const onStack = new Set<string>();

    const visit = (name: string, path: string[]): void => {
      visited.add(name);
      onStack.add(name);
      for (const dependency of dependencies[name] ?? []) {
        if (!visited.has(dependency)) {
          visit(dependency, [...path, dependency]);
        } else if (onStack.has(dependency)) {
          issues.push({
            path: `dependencies.${name}`,
            message: `Circular Integration detected: ${[...path, dependency].join(" -> ")}`,
          });
        }
      }
      onStack.delete(name);
    };

    for (const name of Object.keys(dependencies)) {
      if (!visited.has(name)) {
        visit(name, [name]);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
