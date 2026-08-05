import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";

import type { KnowledgeIndexEventType } from "./knowledge-index-event-type.js";

/** "KnowledgeIndexEvents" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeIndexContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies (e.g. `indexType`). */
export class KnowledgeIndexEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-indexing",
  ) {}

  async publishIndexEvent(
    type: KnowledgeIndexEventType,
    context: KnowledgeIndexContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        assetId: context.assetId,
        workspaceId: context.workspaceId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-indexing",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
