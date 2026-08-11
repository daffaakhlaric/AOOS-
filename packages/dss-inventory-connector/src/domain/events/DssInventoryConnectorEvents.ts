import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { InventoryChanged } from "./InventoryChanged.js";
import type { SyncCompleted } from "./SyncCompleted.js";
import type { SyncFailed } from "./SyncFailed.js";
import type { UnitAdded } from "./UnitAdded.js";
import type { UnitReserved } from "./UnitReserved.js";
import type { UnitSold } from "./UnitSold.js";
import type { UnitUpdated } from "./UnitUpdated.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 7 named events (spec "Events (via
 * @aos/event-bus)"), living under `domain/events/` alongside the payload shapes it publishes —
 * mirroring `@aos/whatsapp-connector`'s `WhatsAppConnectorEvents` convention directly.
 */
export class DssInventoryConnectorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/dss-inventory-connector",
  ) {}

  async publishSyncCompleted(payload: SyncCompleted): Promise<void> {
    await this.publish(
      "aaos.inventory.sync.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishSyncFailed(payload: SyncFailed): Promise<void> {
    await this.publish(
      "aaos.inventory.sync.failed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishUnitAdded(payload: UnitAdded): Promise<void> {
    await this.publish(
      "aaos.inventory.unit.added",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishUnitUpdated(payload: UnitUpdated): Promise<void> {
    await this.publish(
      "aaos.inventory.unit.updated",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishUnitSold(payload: UnitSold): Promise<void> {
    await this.publish(
      "aaos.inventory.unit.sold",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishUnitReserved(payload: UnitReserved): Promise<void> {
    await this.publish(
      "aaos.inventory.unit.reserved",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishInventoryChanged(payload: InventoryChanged): Promise<void> {
    await this.publish("aaos.inventory.changed", payload, payload.tenantId, payload.correlationId);
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
      producer: "@aos/dss-inventory-connector",
      tenantId,
      correlationId,
      // `@aos/event-bus`'s envelope `version` must be a full SemVer string ("x.y.z"), distinct
      // from each payload's own spec-mandated `version: "1.0"` business field above — same
      // distinction `@aos/whatsapp-connector`'s `WhatsAppConnectorEvents` already documents.
      version: "1.0.0",
    });
  }
}
