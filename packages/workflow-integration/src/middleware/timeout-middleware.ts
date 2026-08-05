import { IntegrationTimeoutException } from "../errors/integration-timeout-exception.js";
import type { IWorkflowIntegrationMetrics } from "../metrics/i-workflow-integration-metrics.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/**
 * Eighth stage: races `next()` against a real `setTimeout()`, throwing
 * `IntegrationTimeoutException` if `timeoutMs` elapses first — a no-op pass-through when
 * no `timeoutMs` is configured. Note this cannot cancel an in-flight downstream Adapter
 * call (no cancellation signal is threaded through `IntegrationRequest`); it only stops
 * *waiting* for it — a documented limitation, matching `@aos/workflow-execution`'s own
 * Node Timeout precedent.
 */
export class TimeoutMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "timeout";

  constructor(
    private readonly timeoutMs?: number,
    private readonly metrics?: IWorkflowIntegrationMetrics,
  ) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    if (this.timeoutMs === undefined) {
      await next();
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        this.metrics?.recordTimeout();
        reject(
          new IntegrationTimeoutException(
            `Integration for namespace "${mwContext.namespace}" exceeded its ${this.timeoutMs}ms timeout`,
          ),
        );
      }, this.timeoutMs);
    });

    try {
      await Promise.race([next(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
