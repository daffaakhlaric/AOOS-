import type { CreateJobInput } from "../entities/job.js";

import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";

/** Tenant Validation — Tenant Isolation enforcement. Platform-scoped inputs (no `tenantId`) are never rejected here. */
export class TenantValidator implements IJobValidator {
  readonly name = "tenant";

  validate(input: CreateJobInput, context: ValidationContext): ValidationResult {
    if (input.tenantId === undefined || !context.allowedTenantIds) {
      return { valid: true, issues: [] };
    }
    if (!context.allowedTenantIds.has(input.tenantId)) {
      return {
        valid: false,
        issues: [
          { path: "tenantId", message: `Caller is not authorized for tenant "${input.tenantId}"` },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
