import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { WorkflowIntegrationContext } from "../context/workflow-integration-context.js";

import type { WorkflowIntegrationEventType } from "./workflow-integration-event-type.js";

/** Publishes onto the real `@aos/event-bus` `IPublisher` — every event carries Context metadata (`workflowId`/`workflowInstanceId`/`executionId`/`tenantId`/`correlationId`/`traceId`) plus any extra fields the caller supplies (e.g. `namespace`, `adapterName`). */
export class WorkflowIntegrationEventPublisher {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "workflow-integration",
  ) {}

  async publishIntegrationEvent(
    type: WorkflowIntegrationEventType,
    context: WorkflowIntegrationContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        workflowId: context.workflowId,
        workflowInstanceId: context.workflowInstanceId,
        executionId: context.executionId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/workflow-integration",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
