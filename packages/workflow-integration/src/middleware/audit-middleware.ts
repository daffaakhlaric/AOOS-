import type { IAuditSink } from "./i-audit-sink.js";
import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Tenth (terminal-adjacent) stage: records one `AuditEntry` per attempt via an optional injected `IAuditSink` — a no-op with none configured. */
export class AuditMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "audit";

  constructor(private readonly sink?: IAuditSink) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    await next();
    if (this.sink) {
      await this.sink.record({
        workflowExecutionId: mwContext.context.token.workflowExecutionId,
        namespace: mwContext.namespace,
        tenantId: mwContext.context.tenantId,
        userId: mwContext.context.userId,
        success: mwContext.result?.success,
        occurredAt: new Date().toISOString(),
      });
    }
  }
}
