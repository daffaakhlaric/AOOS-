import type { IWorkflowIntegrationMetrics } from "../metrics/i-workflow-integration-metrics.js";
import { RetryCoordinator } from "../retry/retry-coordinator.js";
import type { RetryPolicy } from "../retry/retry-policy.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/**
 * Seventh stage: re-runs the remainder of the chain (Timeout → Logging → Audit → the
 * terminal resolve+adapter call) whenever `mwContext.result.success` comes back `false`,
 * up to `policy.maxAttempts` — a no-op pass-through when no `RetryPolicy` is configured.
 */
export class RetryMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "retry";

  constructor(
    private readonly policy?: RetryPolicy,
    private readonly metrics?: IWorkflowIntegrationMetrics,
    private readonly coordinator: RetryCoordinator = new RetryCoordinator(),
  ) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    if (!this.policy) {
      await next();
      return;
    }

    const key = mwContext.namespace;
    for (;;) {
      await next();
      if (mwContext.result?.success !== false) {
        return;
      }
      try {
        this.coordinator.recordAttempt(key, this.policy);
      } catch {
        return;
      }
      this.metrics?.recordRetry();
    }
  }
}
