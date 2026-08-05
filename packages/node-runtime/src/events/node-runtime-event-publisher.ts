import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { NodeInstance } from "../instance/node-instance.js";

import type { NodeRuntimeEventType } from "./node-runtime-event-type.js";

/**
 * "Every lifecycle change MUST publish events." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — precedent
 * carried from 005.6B). Publishes onto the real `@aos/event-bus` `IPublisher` — every
 * event carries Node Instance metadata only (id/workflowInstanceId/nodeId/type/status),
 * never anything execution-related.
 */
export class NodeRuntimeEventPublisher {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "node-runtime",
  ) {}

  async publishNodeEvent(
    type: NodeRuntimeEventType,
    instance: NodeInstance,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        nodeInstanceId: instance.id,
        workflowInstanceId: instance.workflowInstanceId,
        nodeId: instance.nodeId,
        type: instance.type,
        status: instance.status,
        ...extra,
      },
      source: this.source,
      producer: "@aos/node-runtime",
    });
  }
}
