import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeContext } from "../context/knowledge-context.js";

import type { KnowledgeEventType } from "./knowledge-event-type.js";

/** "KnowledgeEvents" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies (e.g. `assetId`). */
export class KnowledgeEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-engine",
  ) {}

  async publishKnowledgeEvent(
    type: KnowledgeEventType,
    context: KnowledgeContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        knowledgeId: context.knowledgeId,
        workspaceId: context.workspaceId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-engine",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
