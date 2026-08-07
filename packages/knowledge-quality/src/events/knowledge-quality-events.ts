import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeQualityContext } from "../context/knowledge-quality-context.js";

import type { KnowledgeQualityEventType } from "./knowledge-quality-event-type.js";

/**
 * "KnowledgeQualityEvents" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — publishes onto the real `@aos/event-bus` `IPublisher`.
 */
export class KnowledgeQualityEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-quality",
  ) {}

  async publishQualityEvent(
    type: KnowledgeQualityEventType,
    context: KnowledgeQualityContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        assessmentId: context.assessmentId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-quality",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
