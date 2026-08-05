import { RuntimePermissionException } from "../errors/runtime-permission-exception.js";

import type { IKnowledgeRuntimePermissionChecker } from "./i-permission-checker.js";
import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Third stage: defers to an optional injected `IKnowledgeRuntimePermissionChecker` — permissive by default when none is configured. */
export class PermissionMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "permission";

  constructor(private readonly checker?: IKnowledgeRuntimePermissionChecker) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    if (this.checker) {
      const allowed = await this.checker.check(context.execution, context.operation);
      if (!allowed) {
        throw new RuntimePermissionException(
          `Permission denied for operation "${context.operation}" on Knowledge Runtime Instance "${context.execution.instance.token}"`,
        );
      }
    }
    await next();
  }
}
