import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { EmbeddingContext } from "../context/embedding-context.js";

import type { EmbeddingManagerEventType } from "./embedding-manager-event-type.js";

/**
 * "EmbeddingEvents" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") — publishes
 * onto the real `@aos/event-bus` `IPublisher`.
 */
export class EmbeddingEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "embedding-manager",
  ) {}

  async publishEmbeddingEvent(
    type: EmbeddingManagerEventType,
    context: EmbeddingContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        embeddingId: context.embeddingId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/embedding-manager",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
