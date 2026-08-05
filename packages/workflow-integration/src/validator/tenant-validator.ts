import type {
  IIntegrationValidatorStage,
  IntegrationValidationInput,
  IntegrationValidationResult,
} from "./i-workflow-integration-validator.js";

/** "Tenant" — when `allowedTenantIds` is configured, the Context's `tenantId` must be one of them. */
export class TenantValidator implements IIntegrationValidatorStage {
  readonly name = "tenant";

  validate(input: IntegrationValidationInput): IntegrationValidationResult {
    const issues: IntegrationValidationResult["issues"][number][] = [];
    const { allowedTenantIds, context } = input;

    if (allowedTenantIds && context?.tenantId && !allowedTenantIds.includes(context.tenantId)) {
      issues.push({
        path: "context.tenantId",
        message: `Tenant "${context.tenantId}" is not in the allowed Tenant list`,
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
