import { TenantScope } from "@aos/workflow-definition";

import { PermissionException } from "../errors/permission-exception.js";

import type { IPermissionChecker } from "./i-permission-checker.js";
import type {
  IRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/**
 * Second stage: enforces Tenant Isolation (`Execution Scope`) unconditionally, then
 * defers to an optional injected `IPermissionChecker` for anything finer-grained. With no
 * checker configured, Tenant Isolation is the only enforced rule — permissive by default,
 * matching this package's read-only/definition-only scope.
 */
export class PermissionMiddleware implements IRuntimeMiddleware {
  readonly name = "permission";

  constructor(private readonly checker?: IPermissionChecker) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const { definition } = context.execution;
    const { tenantId } = context.execution.context;
    if (
      definition.tenantScope === TenantScope.TENANT &&
      definition.tenantId !== undefined &&
      tenantId !== definition.tenantId
    ) {
      throw new PermissionException(
        `Tenant Isolation violation: Execution Context tenant "${String(tenantId)}" may not operate on Workflow Definition "${definition.id}" scoped to tenant "${definition.tenantId}"`,
      );
    }

    if (this.checker) {
      const allowed = await this.checker.check(context.execution, context.operation);
      if (!allowed) {
        throw new PermissionException(
          `Permission denied for operation "${context.operation}" on Workflow Instance "${context.execution.instance.token}"`,
        );
      }
    }

    await next();
  }
}
