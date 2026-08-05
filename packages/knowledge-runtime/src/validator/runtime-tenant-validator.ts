import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags a Context `tenantId` not present in a configured allow-list (no-op when unconfigured). */
export class RuntimeTenantValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "tenant";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { allowedTenantIds, execution } = input;
    if (allowedTenantIds && !allowedTenantIds.includes(execution.context.tenantId)) {
      return {
        valid: false,
        issues: [
          {
            path: "context.tenantId",
            message: `Tenant "${execution.context.tenantId}" is not in the allowed Tenant list`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
