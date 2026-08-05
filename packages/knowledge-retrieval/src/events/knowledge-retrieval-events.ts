import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";

import type { KnowledgeRetrievalEventType } from "./knowledge-retrieval-event-type.js";

/** "KnowledgeRetrievalEvents" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeQueryContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies. */
export class KnowledgeRetrievalEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-retrieval",
  ) {}

  async publishRetrievalEvent(
    type: KnowledgeRetrievalEventType,
    context: KnowledgeQueryContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-retrieval",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
