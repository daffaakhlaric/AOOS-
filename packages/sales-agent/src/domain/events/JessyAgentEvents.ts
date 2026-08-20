import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { ConversationClosed } from "./ConversationClosed.js";
import type { ConversationStarted } from "./ConversationStarted.js";
import type { FollowUpScheduled } from "./FollowUpScheduled.js";
import type { HandoffTriggered } from "./HandoffTriggered.js";
import type { LeadBecameHot } from "./LeadBecameHot.js";
import type { LeadScoreUpdated } from "./LeadScoreUpdated.js";
import type { MessageProcessed } from "./MessageProcessed.js";
import type { PropertyLeadScoreUpdated } from "./PropertyLeadScoreUpdated.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 7 named events (spec "Domain — events/"),
 * mirroring `@aos/branch-manager`'s `BranchManagerEvents` / `@aos/dss-inventory-connector`'s
 * `DssInventoryConnectorEvents` convention exactly. `publishPropertyLeadScoreUpdated` is a real,
 * additive 8th event (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8, spec section 12 point 2) —
 * `PropertyLeadScoringService`'s sibling to `publishLeadScoreUpdated`, needed because
 * `PropertyScoringCriterion` is a genuinely different union from `ScoringCriterion`.
 */
export class JessyAgentEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/sales-agent",
  ) {}

  async publishConversationStarted(payload: ConversationStarted): Promise<void> {
    await this.publish(
      "aaos.sales.conversation.started",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishMessageProcessed(payload: MessageProcessed): Promise<void> {
    await this.publish(
      "aaos.sales.message.processed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishLeadScoreUpdated(payload: LeadScoreUpdated): Promise<void> {
    await this.publish(
      "aaos.sales.lead.score-updated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishPropertyLeadScoreUpdated(payload: PropertyLeadScoreUpdated): Promise<void> {
    await this.publish(
      "aaos.sales.property-lead.score-updated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishLeadBecameHot(payload: LeadBecameHot): Promise<void> {
    await this.publish(
      "aaos.sales.lead.became-hot",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishHandoffTriggered(payload: HandoffTriggered): Promise<void> {
    await this.publish(
      "aaos.sales.handoff.triggered",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishFollowUpScheduled(payload: FollowUpScheduled): Promise<void> {
    await this.publish(
      "aaos.sales.follow-up.scheduled",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishConversationClosed(payload: ConversationClosed): Promise<void> {
    await this.publish(
      "aaos.sales.conversation.closed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  private async publish<T>(
    type: string,
    payload: T,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload,
      source: this.source,
      producer: "@aos/sales-agent",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
