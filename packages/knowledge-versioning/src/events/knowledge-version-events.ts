import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";

import type { KnowledgeVersionEventType } from "./knowledge-version-event-type.js";

/**
 * "KnowledgeVersionEvents" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API") —
 * publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries
 * `KnowledgeVersionContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`)
 * plus any extra fields the caller supplies.
 */
export class KnowledgeVersionEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-versioning",
  ) {}

  async publishVersionEvent(
    type: KnowledgeVersionEventType,
    context: KnowledgeVersionContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        versionId: context.versionId,
        assetId: context.assetId,
        branchId: context.branchId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-versioning",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
