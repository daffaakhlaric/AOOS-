import { createTraceContext, type ITracer } from "@aos/event-bus";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Third stage: wraps the remaining pipeline in one Span per integration attempt, using the Context's `correlationId`/`traceId` as the Trace Context seed — "Every integration must carry CorrelationId, ExecutionToken, TraceId, WorkflowId, NodeId, TenantId." */
export class TracingMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "tracing";

  constructor(private readonly tracer: ITracer) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    const { context } = mwContext;
    const traceContext = createTraceContext(context.correlationId);
    const span = this.tracer.startSpan(
      `workflow-integration.${mwContext.namespace}`,
      traceContext,
      {
        workflowId: context.workflowId,
        workflowInstanceId: context.workflowInstanceId,
        executionId: context.executionId,
        ...(context.tenantId ? { tenantId: context.tenantId } : {}),
      },
    );
    mwContext.metadata["traceContext"] = traceContext;
    try {
      await next();
      span.end({ outcome: mwContext.result?.success ? "success" : "unresolved" });
    } catch (error) {
      span.end({ outcome: "error", error: String(error) });
      throw error;
    }
  }
}
