import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { WorkflowInstance } from "../instance/workflow-instance.js";

import type { WorkflowRuntimeEventType } from "./workflow-runtime-event-type.js";

/**
 * "Every lifecycle change MUST publish events. No direct communication." (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md — "EVENT BUS").
 * Publishes onto the real `@aos/event-bus` `IPublisher` — every event carries Instance
 * metadata only (id/token/workflowId/version/status), never Node execution detail.
 */
export class WorkflowRuntimeEventPublisher {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "workflow-runtime",
  ) {}

  async publishInstanceEvent(
    type: WorkflowRuntimeEventType,
    instance: WorkflowInstance,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        instanceId: instance.id,
        token: instance.token,
        workflowId: instance.workflowId,
        workflowVersion: instance.workflowVersion,
        status: instance.status,
        ...extra,
      },
      source: this.source,
      producer: "@aos/workflow-runtime",
      tenantId: instance.tenantId,
    });
  }
}
