import { NodePermissionException } from "../errors/node-permission-exception.js";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./i-node-middleware.js";
import type { INodePermissionChecker } from "./i-node-permission-checker.js";

/**
 * Second stage: defers to an optional injected `INodePermissionChecker` — "Execution
 * Scope"/"Permission Interface" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md —
 * "SECURITY"). With no checker configured, every operation is allowed — permissive by
 * default, matching this package's contract-only/no-execution scope.
 */
export class PermissionMiddleware implements INodeMiddleware {
  readonly name = "permission";

  constructor(private readonly checker?: INodePermissionChecker) {}

  async execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void> {
    if (this.checker) {
      const allowed = await this.checker.check(context.execution, context.operation);
      if (!allowed) {
        throw new NodePermissionException(
          `Permission denied for operation "${context.operation}" on Node Instance "${context.execution.instance.id}"`,
        );
      }
    }
    await next();
  }
}
