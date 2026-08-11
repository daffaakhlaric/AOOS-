import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { ConversationStarted } from "./ConversationStarted.js";
import type { MessageDelivered } from "./MessageDelivered.js";
import type { MessageFailed } from "./MessageFailed.js";
import type { MessageRead } from "./MessageRead.js";
import type { MessageReceived } from "./MessageReceived.js";
import type { MessageSent } from "./MessageSent.js";
import type { WabaRegistered } from "./WabaRegistered.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 7 named events (spec "Events (via
 * @aos/event-bus)"), living under `domain/events/` alongside the payload shapes it publishes —
 * mirroring `@aos/meta-ads-connector`'s `MetaAdsConnectorEvents` convention directly.
 */
export class WhatsAppConnectorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/whatsapp-connector",
  ) {}

  async publishMessageReceived(payload: MessageReceived): Promise<void> {
    await this.publish(
      "aaos.whatsapp.message.received",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishMessageSent(payload: MessageSent): Promise<void> {
    await this.publish(
      "aaos.whatsapp.message.sent",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishMessageDelivered(payload: MessageDelivered): Promise<void> {
    await this.publish(
      "aaos.whatsapp.message.delivered",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishMessageRead(payload: MessageRead): Promise<void> {
    await this.publish(
      "aaos.whatsapp.message.read",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishMessageFailed(payload: MessageFailed): Promise<void> {
    await this.publish(
      "aaos.whatsapp.message.failed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishConversationStarted(payload: ConversationStarted): Promise<void> {
    await this.publish(
      "aaos.whatsapp.conversation.started",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishWabaRegistered(payload: WabaRegistered): Promise<void> {
    await this.publish(
      "aaos.whatsapp.waba.registered",
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
      producer: "@aos/whatsapp-connector",
      tenantId,
      correlationId,
      // `@aos/event-bus`'s envelope `version` must be a full SemVer string ("x.y.z"), distinct
      // from each payload's own spec-mandated `version: "1.0"` business field above — the same
      // distinction `@aos/meta-ads-connector`'s `MetaAdsConnectorEvents` already documents.
      version: "1.0.0",
    });
  }
}
