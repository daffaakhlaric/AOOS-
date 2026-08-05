import { createTraceContext, type ITracer } from "@aos/event-bus";

import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./i-execution-middleware.js";

/** Third stage: wraps the remaining pipeline in one Span per operation, using the Execution Token's `correlationId`/`traceId` as the Trace Context seed — "OpenTelemetry Ready". */
export class TracingMiddleware implements IExecutionMiddleware {
  readonly name = "tracing";

  constructor(private readonly tracer: ITracer) {}

  async execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void> {
    const { token } = context.session.context;
    const traceContext = createTraceContext(token.correlationId);
    const span = this.tracer.startSpan(`workflow-execution.${context.operation}`, traceContext, {
      workflowExecutionId: token.workflowExecutionId,
      workflowInstanceId: token.workflowInstanceId,
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
