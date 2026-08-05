import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/** "Version" — every registered Adapter's `version` must be a valid `MAJOR.MINOR.PATCH` string. */
export class VersionValidator implements IIntegrationValidatorStage {
  readonly name = "version";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];

    for (const namespace of input.registry.listNamespaces()) {
      for (const adapter of input.registry.list(namespace)) {
        if (!SEMVER_PATTERN.test(adapter.version)) {
          issues.push({
            path: `adapters.${adapter.name}.version`,
            message: `Adapter "${adapter.name}" has an invalid version "${adapter.version}" — expected MAJOR.MINOR.PATCH`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
