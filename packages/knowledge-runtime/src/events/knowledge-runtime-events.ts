import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeRuntimeContext } from "../context/knowledge-runtime-context.js";

import type { KnowledgeRuntimeEventType } from "./knowledge-runtime-event-type.js";

/** "KnowledgeRuntimeEvents" (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md — "PUBLIC API") — publishes onto the real `@aos/event-bus` `IPublisher`. Every event carries `KnowledgeRuntimeContext` metadata (`tenantId`/`workspaceId`/`correlationId`/`traceId`) plus any extra fields the caller supplies (e.g. `token`). */
export class KnowledgeRuntimeEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-runtime",
  ) {}

  async publishRuntimeEvent(
    type: KnowledgeRuntimeEventType,
    context: KnowledgeRuntimeContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        knowledgeId: context.knowledgeId,
        runtimeId: context.runtimeId,
        token: context.token,
        workspaceId: context.workspaceId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-runtime",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
