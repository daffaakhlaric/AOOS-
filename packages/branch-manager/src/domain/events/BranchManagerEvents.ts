import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { BranchConfigUpdated } from "./BranchConfigUpdated.js";
import type { LeadAssigned } from "./LeadAssigned.js";
import type { LeadQueued } from "./LeadQueued.js";
import type { QueueFlushed } from "./QueueFlushed.js";
import type { SalesStatusChanged } from "./SalesStatusChanged.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 5 named events (spec "Events (via
 * @aos/event-bus)"), living under `domain/events/` alongside the payload shapes it publishes —
 * mirroring `@aos/dss-inventory-connector`'s `DssInventoryConnectorEvents` /
 * `@aos/whatsapp-connector`'s `WhatsAppConnectorEvents` convention directly. Not itself listed in
 * the spec's folder tree (neither sibling package's identical wrapper class is either); added for
 * the same reason those two packages added theirs — `LeadAssignmentService`/`AvailabilityService`/
 * `QueueService`/`BranchRegistry` need one place that knows the 5 event `type` strings and the
 * envelope-wiring boilerplate (`category`, `source`, `producer`, `version`).
 */
export class BranchManagerEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/branch-manager",
  ) {}

  async publishLeadAssigned(payload: LeadAssigned): Promise<void> {
    await this.publish(
      "aaos.branch.lead.assigned",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishLeadQueued(payload: LeadQueued): Promise<void> {
    await this.publish("aaos.branch.lead.queued", payload, payload.tenantId, payload.correlationId);
  }

  async publishSalesStatusChanged(payload: SalesStatusChanged): Promise<void> {
    await this.publish(
      "aaos.branch.sales.status-changed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishBranchConfigUpdated(payload: BranchConfigUpdated): Promise<void> {
    await this.publish(
      "aaos.branch.config.updated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishQueueFlushed(payload: QueueFlushed): Promise<void> {
    await this.publish(
      "aaos.branch.queue.flushed",
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
      producer: "@aos/branch-manager",
      tenantId,
      correlationId,
      // `@aos/event-bus`'s envelope `version` must be a full SemVer string ("x.y.z"), distinct
      // from each payload's own spec-mandated `version: "1.0"` business field above — same
      // distinction the sibling packages' equivalents already document.
      version: "1.0.0",
    });
  }
}
