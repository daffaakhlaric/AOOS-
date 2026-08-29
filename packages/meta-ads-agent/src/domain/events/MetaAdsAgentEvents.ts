import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { AgentCycleCompleted } from "./AgentCycleCompleted.js";
import type { AgentCycleStarted } from "./AgentCycleStarted.js";
import type { AgentError } from "./AgentError.js";
import type { CreativeBriefGenerated } from "./CreativeBriefGenerated.js";
import type { DecisionEscalated } from "./DecisionEscalated.js";
import type { DecisionExecuted } from "./DecisionExecuted.js";
import type { DecisionMade } from "./DecisionMade.js";
import type { DigestGenerated } from "./DigestGenerated.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 8 named events (spec "Events (via
 * @aos/event-bus)"), mirroring `@aos/objective-engine`'s `ObjectiveEngineEvents` /
 * `@aos/meta-ads-connector`'s `MetaAdsConnectorEvents` convention.
 *
 * Same bug-avoidance note as both sibling packages: `@aos/event-bus`'s envelope `version` must be
 * a full SemVer string ("x.y.z"), distinct from each payload's own spec-mandated `version: "1.0"`
 * business field — `publish()` below always passes the literal `"1.0.0"` as the envelope version.
 */
export class MetaAdsAgentEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/meta-ads-agent",
  ) {}

  async publishAgentCycleStarted(payload: AgentCycleStarted): Promise<void> {
    await this.publish(
      "aaos.samantha.cycle.started",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishAgentCycleCompleted(payload: AgentCycleCompleted): Promise<void> {
    await this.publish(
      "aaos.samantha.cycle.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishDecisionMade(payload: DecisionMade): Promise<void> {
    await this.publish(
      "aaos.samantha.decision.made",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishDecisionExecuted(payload: DecisionExecuted): Promise<void> {
    await this.publish(
      "aaos.samantha.decision.executed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishDecisionEscalated(payload: DecisionEscalated): Promise<void> {
    await this.publish(
      "aaos.samantha.decision.escalated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishCreativeBriefGenerated(payload: CreativeBriefGenerated): Promise<void> {
    await this.publish(
      "aaos.samantha.creative.briefed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishDigestGenerated(payload: DigestGenerated): Promise<void> {
    await this.publish(
      "aaos.samantha.digest.generated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishAgentError(payload: AgentError): Promise<void> {
    await this.publish("aaos.samantha.error", payload, payload.tenantId, payload.correlationId);
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
      producer: "@aos/meta-ads-agent",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
