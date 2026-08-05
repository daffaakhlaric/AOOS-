import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

/** "Environment" — when `allowedEnvironments` is configured, the Context's `environment` must be one of them. */
export class EnvironmentValidator implements IIntegrationValidatorStage {
  readonly name = "environment";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];
    const { allowedEnvironments, context } = input;

    if (
      allowedEnvironments &&
      context?.environment &&
      !allowedEnvironments.includes(context.environment)
    ) {
      issues.push({
        path: "context.environment",
        message: `Environment "${context.environment}" is not in the allowed Environment list`,
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
