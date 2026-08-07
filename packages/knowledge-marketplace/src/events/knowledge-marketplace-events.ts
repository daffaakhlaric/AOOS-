import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeMarketplaceContext } from "../context/knowledge-marketplace-context.js";

import type { KnowledgeMarketplaceEventType } from "./knowledge-marketplace-event-type.js";

/**
 * "KnowledgeMarketplaceEvents" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Public
 * API") — publishes onto the real `@aos/event-bus` `IPublisher`.
 */
export class KnowledgeMarketplaceEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-marketplace",
  ) {}

  async publishMarketplaceEvent(
    type: KnowledgeMarketplaceEventType,
    context: KnowledgeMarketplaceContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        listingId: context.listingId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-marketplace",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
