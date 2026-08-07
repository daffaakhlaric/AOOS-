import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";

import type { KnowledgePolicyEventType } from "./knowledge-policy-event-type.js";

/**
 * "KnowledgePolicyEvents" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * publishes onto the real `@aos/event-bus` `IPublisher`.
 */
export class KnowledgePolicyEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "knowledge-policy",
  ) {}

  async publishPolicyEvent(
    type: KnowledgePolicyEventType,
    context: KnowledgePolicyContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.LIFECYCLE,
      payload: {
        token: context.token,
        workspaceId: context.workspaceId,
        policyId: context.policyId,
        ...extra,
      },
      source: this.source,
      producer: "@aos/knowledge-policy",
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });
  }
}
