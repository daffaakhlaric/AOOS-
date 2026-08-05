import { createTraceContext, type ITracer } from "@aos/event-bus";

import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Fifth stage: wraps the remaining pipeline in one Span per operation, using `KnowledgeRuntimeContext.correlationId` as the Trace Context seed. */
export class TracingMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "tracing";

  constructor(private readonly tracer: ITracer) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const traceContext = createTraceContext(context.execution.context.correlationId);
    const span = this.tracer.startSpan(`knowledge-runtime.${context.operation}`, traceContext, {
      instanceToken: context.execution.instance.token,
      knowledgeId: context.execution.instance.knowledgeId,
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
