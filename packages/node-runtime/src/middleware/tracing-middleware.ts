import { createTraceContext, type ITracer } from "@aos/event-bus";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./i-node-middleware.js";

/** Third stage: wraps the remaining pipeline in one Span per operation, using `NodeContext.correlationId`/`traceId` as the Trace Context seed — "OpenTelemetry Ready" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "MONITORING"). */
export class TracingMiddleware implements INodeMiddleware {
  readonly name = "tracing";

  constructor(private readonly tracer: ITracer) {}

  async execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void> {
    const traceContext = createTraceContext(context.execution.context.correlationId);
    const span = this.tracer.startSpan(`node-runtime.${context.operation}`, traceContext, {
      nodeInstanceId: context.execution.instance.id,
      nodeType: context.execution.instance.type,
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
