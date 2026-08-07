import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeGeneratorContext } from "../context/knowledge-generator-context.js";

import type { KnowledgeGeneratorEventType } from "./knowledge-generator-event-type.js";

/**
 * "KnowledgeGeneratorEvents" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — publishes onto the real `@aos/event-bus` `IPublisher`.
 */
export class KnowledgeGeneratorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-generator",
  ) {}

  async publishGeneratorEvent(
    type: KnowledgeGeneratorEventType,
    context: KnowledgeGeneratorContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        generationId: context.generationId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-generator",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
