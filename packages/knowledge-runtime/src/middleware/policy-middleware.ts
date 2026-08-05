import { RuntimePolicyException } from "../errors/runtime-policy-exception.js";

import type { IKnowledgeRuntimePolicyChecker } from "./i-policy-checker.js";
import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Fourth stage: defers to an optional injected `IKnowledgeRuntimePolicyChecker` — permissive by default when none is configured. */
export class PolicyMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "policy";

  constructor(private readonly checker?: IKnowledgeRuntimePolicyChecker) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    if (this.checker) {
      const allowed = await this.checker.check(context.execution, context.operation);
      if (!allowed) {
        throw new RuntimePolicyException(
          `Policy violation for operation "${context.operation}" on Knowledge Runtime Instance "${context.execution.instance.token}"`,
        );
      }
    }
    await next();
  }
}
