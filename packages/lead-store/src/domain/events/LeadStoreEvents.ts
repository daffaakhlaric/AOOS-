import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { ClosingRecorded } from "./ClosingRecorded.js";
import type { ConversationUpdated } from "./ConversationUpdated.js";
import type { LeadAssigned } from "./LeadAssigned.js";
import type { LeadBecameHot } from "./LeadBecameHot.js";
import type { LeadCreated } from "./LeadCreated.js";
import type { LeadStatusChanged } from "./LeadStatusChanged.js";
import type { ScoreUpdated } from "./ScoreUpdated.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 7 named events, living under
 * `domain/events/` alongside the payload shapes it publishes — mirrors
 * `@aos/branch-manager`'s `BranchManagerEvents` / `@aos/whatsapp-connector`'s
 * `WhatsAppConnectorEvents` convention directly.
 */
export class LeadStoreEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/lead-store",
  ) {}

  async publishLeadCreated(payload: LeadCreated): Promise<void> {
    await this.publish(
      "aaos.lead-store.lead.created",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishLeadStatusChanged(payload: LeadStatusChanged): Promise<void> {
    await this.publish(
      "aaos.lead-store.lead.status-changed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishLeadAssigned(payload: LeadAssigned): Promise<void> {
    await this.publish(
      "aaos.lead-store.lead.assigned",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishLeadBecameHot(payload: LeadBecameHot): Promise<void> {
    await this.publish(
      "aaos.lead-store.lead.became-hot",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishConversationUpdated(payload: ConversationUpdated): Promise<void> {
    await this.publish(
      "aaos.lead-store.conversation.updated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishClosingRecorded(payload: ClosingRecorded): Promise<void> {
    await this.publish(
      "aaos.lead-store.closing.recorded",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishScoreUpdated(payload: ScoreUpdated): Promise<void> {
    await this.publish(
      "aaos.lead-store.lead.score-updated",
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
      producer: "@aos/lead-store",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
