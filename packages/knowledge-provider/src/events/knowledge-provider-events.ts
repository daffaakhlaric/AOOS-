import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";

import type { KnowledgeProviderEventType } from "./knowledge-provider-event-type.js";

/** "KnowledgeProviderEvents" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeProviderContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies. */
export class KnowledgeProviderEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-provider",
  ) {}

  async publishProviderEvent(
    type: KnowledgeProviderEventType,
    context: KnowledgeProviderContext,
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
      producer: "@aos/knowledge-provider",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
