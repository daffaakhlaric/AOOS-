import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { AssetArchived } from "./AssetArchived.js";
import type { AssetTagged } from "./AssetTagged.js";
import type { AssetUploaded } from "./AssetUploaded.js";
import type { CollectionUpdated } from "./CollectionUpdated.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for the spec's 4 named events, living under
 * `domain/events/` alongside the payload shapes it publishes — mirrors `@aos/lead-store`'s
 * `LeadStoreEvents` convention directly. Event type strings match the spec's "Events" section
 * exactly.
 */
export class AssetLibraryEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/asset-library",
  ) {}

  async publishAssetUploaded(payload: AssetUploaded): Promise<void> {
    await this.publish("aaos.assets.uploaded", payload, payload.tenantId, payload.correlationId);
  }

  async publishAssetArchived(payload: AssetArchived): Promise<void> {
    await this.publish("aaos.assets.archived", payload, payload.tenantId, payload.correlationId);
  }

  async publishAssetTagged(payload: AssetTagged): Promise<void> {
    await this.publish("aaos.assets.tagged", payload, payload.tenantId, payload.correlationId);
  }

  async publishCollectionUpdated(payload: CollectionUpdated): Promise<void> {
    await this.publish(
      "aaos.assets.collection.updated",
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
      producer: "@aos/asset-library",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
