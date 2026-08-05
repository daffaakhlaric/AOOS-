import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";

import type { KnowledgeSynchronizationEventType } from "./knowledge-synchronization-event-type.js";

/** "KnowledgeSynchronizationEvents" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeSynchronizationContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies. */
export class KnowledgeSynchronizationEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-synchronization",
  ) {}

  async publishSynchronizationEvent(
    type: KnowledgeSynchronizationEventType,
    context: KnowledgeSynchronizationContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        providerId: context.providerId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-synchronization",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
