import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { CampaignAttributed } from "./CampaignAttributed.js";
import type { ClosingReportGenerated } from "./ClosingReportGenerated.js";
import type { MilestoneReached } from "./MilestoneReached.js";
import type { ObjectiveCompleted } from "./ObjectiveCompleted.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 4 named events, living under
 * `domain/events/` alongside the payload shapes it publishes — mirrors `@aos/lead-store`'s
 * `LeadStoreEvents` / `@aos/branch-manager`'s `BranchManagerEvents` convention directly.
 */
export class ClosingTrackerEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/closing-tracker",
  ) {}

  async publishClosingReportGenerated(payload: ClosingReportGenerated): Promise<void> {
    await this.publish(
      "aaos.closing-tracker.report.generated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishMilestoneReached(payload: MilestoneReached): Promise<void> {
    await this.publish(
      "aaos.closing-tracker.milestone.reached",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishCampaignAttributed(payload: CampaignAttributed): Promise<void> {
    await this.publish(
      "aaos.closing-tracker.campaign.attributed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishObjectiveCompleted(payload: ObjectiveCompleted): Promise<void> {
    await this.publish(
      "aaos.closing-tracker.objective.completed",
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
      producer: "@aos/closing-tracker",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
