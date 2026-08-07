import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgeValidatorContext } from "../context/knowledge-validator-context.js";

import type { KnowledgeValidatorEventType } from "./knowledge-validator-event-type.js";

/**
 * "KnowledgeValidatorEvents" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — publishes onto the real `@aos/event-bus` `IPublisher`.
 */
export class KnowledgeValidatorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-validator",
  ) {}

  async publishValidatorEvent(
    type: KnowledgeValidatorEventType,
    context: KnowledgeValidatorContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        validationId: context.validationId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-validator",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
