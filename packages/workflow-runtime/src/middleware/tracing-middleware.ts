import { createTraceContext, type ITracer } from "@aos/event-bus";

import type {
  IRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Third stage: wraps the remaining pipeline in one Span per operation, using `WorkflowContext.correlationId`/`traceId` as the Trace Context seed — "OpenTelemetry Ready" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md — "MONITORING"). */
export class TracingMiddleware implements IRuntimeMiddleware {
  readonly name = "tracing";

  constructor(private readonly tracer: ITracer) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const traceContext = createTraceContext(context.execution.context.correlationId);
    const span = this.tracer.startSpan(`workflow-runtime.${context.operation}`, traceContext, {
      instanceToken: context.execution.instance.token,
      workflowId: context.execution.instance.workflowId,
    });
    context.metadata["traceContext"] = traceContext;
    try {
      await next();
      span.end({ outcome: "success" });
    } catch (error) {
      span.end({ outcome: "error", error: String(error) });
      throw error;
    }
  }
}
