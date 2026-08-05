import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Tenant" — when `allowedTenantIds` is configured, the Asset's `scope.tenantId` must be one of them. */
export class TenantValidator implements IKnowledgeValidatorStage {
  readonly name = "tenant";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const tenantId = input.asset?.scope.tenantId;
    if (input.allowedTenantIds && tenantId && !input.allowedTenantIds.includes(tenantId)) {
      issues.push({
        path: "scope.tenantId",
        message: `Tenant "${tenantId}" is not in the allowed Tenant list`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
