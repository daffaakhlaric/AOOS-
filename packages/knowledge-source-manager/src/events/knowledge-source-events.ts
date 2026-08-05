import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";

import type { KnowledgeSourceEventType } from "./knowledge-source-event-type.js";

/** "KnowledgeSourceEvents" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeSourceContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies. */
export class KnowledgeSourceEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-source-manager",
  ) {}

  async publishSourceEvent(
    type: KnowledgeSourceEventType,
    context: KnowledgeSourceContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        sourceId: context.sourceId,
        providerId: context.providerId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-source-manager",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
