import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventValidator, ValidationContext, ValidationResult } from "./i-event-validator.js";

/**
 * Tenant Validation — Tenant Isolation enforcement. If `context.allowedTenantIds` is set,
 * a tenant-scoped event (`tenantId` present) must name one of those tenants. Platform-scoped
 * events (no `tenantId`) are never rejected here — tenant scoping is opt-in per event.
 */
export class TenantValidator implements IEventValidator {
  readonly name = "tenant";

  validate(event: BaseEventShape, context: ValidationContext): ValidationResult {
    if (event.tenantId === undefined || !context.allowedTenantIds) {
      return { valid: true, issues: [] };
    }
    if (!context.allowedTenantIds.has(event.tenantId)) {
      return {
        valid: false,
        issues: [
          {
            path: "tenantId",
            message: `Caller is not authorized for tenant "${event.tenantId}"`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
