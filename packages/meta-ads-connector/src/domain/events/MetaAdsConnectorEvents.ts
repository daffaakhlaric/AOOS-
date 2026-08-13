import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { AdPaused } from "./AdPaused.js";
import type { BudgetScaled } from "./BudgetScaled.js";
import type { LeadReceived } from "./LeadReceived.js";
import type { NewCampaignCreated } from "./NewCampaignCreated.js";
import type { ObjectiveFixed } from "./ObjectiveFixed.js";
import type { SyncCompleted } from "./SyncCompleted.js";
import type { SyncFailed } from "./SyncFailed.js";

/**
 * Placement note: this wraps the real `@aos/event-bus` `IPublisher` for all 6 named events (spec
 * "Events (via @aos/event-bus)"), living under `domain/events/` alongside the payload shapes it
 * publishes — mirroring `@aos/embedding-manager`'s `EmbeddingEvents` convention
 * (`packages/embedding-manager/src/events/embedding-events.ts`) — rather than under
 * `application/`, since it has no use-case-orchestration logic of its own, only event shaping.
 */
export class MetaAdsConnectorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/meta-ads-connector",
  ) {}

  async publishSyncCompleted(payload: SyncCompleted): Promise<void> {
    await this.publish(
      "aaos.meta.sync.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishSyncFailed(payload: SyncFailed): Promise<void> {
    await this.publish("aaos.meta.sync.failed", payload, payload.tenantId, payload.correlationId);
  }

  async publishLeadReceived(payload: LeadReceived): Promise<void> {
    await this.publish("aaos.meta.lead.received", payload, payload.tenantId, payload.correlationId);
  }

  async publishAdPaused(payload: AdPaused): Promise<void> {
    await this.publish("aaos.meta.ad.paused", payload, payload.tenantId, payload.correlationId);
  }

  async publishBudgetScaled(payload: BudgetScaled): Promise<void> {
    await this.publish("aaos.meta.budget.scaled", payload, payload.tenantId, payload.correlationId);
  }

  async publishObjectiveFixed(payload: ObjectiveFixed): Promise<void> {
    await this.publish(
      "aaos.meta.objective.fixed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  /** AAOS-W1D-S3: emitted by `CreateCampaign` after successfully creating a new OUTCOME_LEADS + CTWA campaign/adset pair. */
  async publishNewCampaignCreated(payload: NewCampaignCreated): Promise<void> {
    await this.publish(
      "aaos.meta.campaign.created",
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
      producer: "@aos/meta-ads-connector",
      tenantId,
      correlationId,
      // `@aos/event-bus`'s envelope `version` must be a full SemVer string ("x.y.z" — see
      // `baseEventSchema`'s regex in packages/event-bus/src/contracts/base-event.ts); this is
      // distinct from each payload's own spec-mandated `version: "1.0"` business field above.
      // Passing "1.0" here (bug found while writing integration tests against a real
      // `EventPublisher`) fails schema validation and throws `ValidationException` on every publish.
      version: "1.0.0",
    });
  }
}
