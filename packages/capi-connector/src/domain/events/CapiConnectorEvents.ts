import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { BatchCompleted } from "./BatchCompleted.js";
import type { EmqScoreReceived } from "./EmqScoreReceived.js";
import type { EventFailed } from "./EventFailed.js";
import type { EventSent } from "./EventSent.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 4 named events, living under
 * `domain/events/` alongside the payload shapes it publishes — mirrors `@aos/lead-store`'s
 * `LeadStoreEvents` / `@aos/closing-tracker`'s `ClosingTrackerEvents` convention directly.
 */
export class CapiConnectorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/capi-connector",
  ) {}

  async publishEventSent(payload: EventSent): Promise<void> {
    await this.publish(
      "aaos.capi-connector.event.sent",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishEventFailed(payload: EventFailed): Promise<void> {
    await this.publish(
      "aaos.capi-connector.event.failed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishBatchCompleted(payload: BatchCompleted): Promise<void> {
    await this.publish(
      "aaos.capi-connector.batch.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishEmqScoreReceived(payload: EmqScoreReceived): Promise<void> {
    await this.publish(
      "aaos.capi-connector.emq.received",
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
      producer: "@aos/capi-connector",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
