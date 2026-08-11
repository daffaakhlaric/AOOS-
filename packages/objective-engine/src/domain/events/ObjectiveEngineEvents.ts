import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { ObjectiveCompleted } from "./ObjectiveCompleted.js";
import type { ObjectiveCreated } from "./ObjectiveCreated.js";
import type { ObjectiveOffTrack } from "./ObjectiveOffTrack.js";
import type { ObjectiveUpdated } from "./ObjectiveUpdated.js";
import type { ProgressUpdated } from "./ProgressUpdated.js";
import type { RecommendationGenerated } from "./RecommendationGenerated.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 6 named events (spec "Events (via
 * @aos/event-bus)"), living under `domain/events/` alongside the payload shapes it publishes —
 * mirroring `@aos/meta-ads-connector`'s `MetaAdsConnectorEvents` convention.
 *
 * Bug-avoidance note (same pitfall documented in `@aos/meta-ads-connector`): `@aos/event-bus`'s
 * envelope `version` must be a full SemVer string ("x.y.z") — see `baseEventSchema` in
 * `packages/event-bus/src/contracts/base-event.ts` — which is distinct from each payload's own
 * spec-mandated `version: "1.0"` business field. Passing "1.0" as the envelope `version` fails
 * schema validation, so `publish()` below always passes the literal `"1.0.0"`.
 */
export class ObjectiveEngineEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/objective-engine",
  ) {}

  async publishObjectiveCreated(payload: ObjectiveCreated): Promise<void> {
    await this.publish("aaos.objective.created", payload, payload.tenantId, payload.correlationId);
  }

  async publishObjectiveUpdated(payload: ObjectiveUpdated): Promise<void> {
    await this.publish("aaos.objective.updated", payload, payload.tenantId, payload.correlationId);
  }

  async publishObjectiveCompleted(payload: ObjectiveCompleted): Promise<void> {
    await this.publish(
      "aaos.objective.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishProgressUpdated(payload: ProgressUpdated): Promise<void> {
    await this.publish(
      "aaos.objective.progress.updated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishObjectiveOffTrack(payload: ObjectiveOffTrack): Promise<void> {
    await this.publish(
      "aaos.objective.off-track",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishRecommendationGenerated(payload: RecommendationGenerated): Promise<void> {
    await this.publish(
      "aaos.objective.recommendation",
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
      producer: "@aos/objective-engine",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
