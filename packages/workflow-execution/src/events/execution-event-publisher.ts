import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { ExecutionToken } from "../token/execution-token.js";

import type { ExecutionEventType } from "./execution-event-type.js";

/** Publishes onto the real `@aos/event-bus` `IPublisher` — every event carries Execution Token metadata plus any extra fields the caller supplies (e.g. `nodeId`, `status`). */
export class ExecutionEventPublisher {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "workflow-execution",
  ) {}

  async publishExecutionEvent(
    type: ExecutionEventType,
    token: ExecutionToken,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        workflowExecutionId: token.workflowExecutionId,
        workflowInstanceId: token.workflowInstanceId,
        executionId: token.executionId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/workflow-execution",
      tenantId: token.tenantId,
      correlationId: token.correlationId,
      traceId: token.traceId,
    });
  }
}
