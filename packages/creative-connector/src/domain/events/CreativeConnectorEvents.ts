import { randomUUID } from "node:crypto";

import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { FileUploaded } from "./FileUploaded.js";
import type { ImageGenerationCompleted } from "./ImageGenerationCompleted.js";
import type { ImageGenerationFailed } from "./ImageGenerationFailed.js";
import type { ImageGenerationStarted } from "./ImageGenerationStarted.js";
import type { VideoGenerationCompleted } from "./VideoGenerationCompleted.js";
import type { VideoGenerationFailed } from "./VideoGenerationFailed.js";
import type { VideoGenerationStarted } from "./VideoGenerationStarted.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for this package's 7 named events, mirroring
 * `@aos/mobix-web-scraper`'s `MobixScraperEvents` / `@aos/meta-ads-connector`'s
 * `MetaAdsConnectorEvents` convention. `@aos/event-bus`'s envelope `version` is a full SemVer
 * string ("1.0.0"), distinct from each payload's own `version: "1.0"` business field.
 */
export class CreativeConnectorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/creative-connector",
  ) {}

  async publishFileUploaded(payload: FileUploaded, correlationId?: string): Promise<void> {
    await this.publish("aaos.creative-connector.file.uploaded", payload, correlationId);
  }

  async publishVideoGenerationStarted(
    payload: VideoGenerationStarted,
    correlationId?: string,
  ): Promise<void> {
    await this.publish("aaos.creative-connector.video.generation-started", payload, correlationId);
  }

  async publishVideoGenerationCompleted(
    payload: VideoGenerationCompleted,
    correlationId?: string,
  ): Promise<void> {
    await this.publish(
      "aaos.creative-connector.video.generation-completed",
      payload,
      correlationId,
    );
  }

  async publishVideoGenerationFailed(
    payload: VideoGenerationFailed,
    correlationId?: string,
  ): Promise<void> {
    await this.publish("aaos.creative-connector.video.generation-failed", payload, correlationId);
  }

  async publishImageGenerationStarted(
    payload: ImageGenerationStarted,
    correlationId?: string,
  ): Promise<void> {
    await this.publish("aaos.creative-connector.image.generation-started", payload, correlationId);
  }

  async publishImageGenerationCompleted(
    payload: ImageGenerationCompleted,
    correlationId?: string,
  ): Promise<void> {
    await this.publish(
      "aaos.creative-connector.image.generation-completed",
      payload,
      correlationId,
    );
  }

  async publishImageGenerationFailed(
    payload: ImageGenerationFailed,
    correlationId?: string,
  ): Promise<void> {
    await this.publish("aaos.creative-connector.image.generation-failed", payload, correlationId);
  }

  private async publish<T>(type: string, payload: T, correlationId?: string): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload,
      source: this.source,
      producer: "@aos/creative-connector",
      correlationId: correlationId ?? randomUUID(),
      version: "1.0.0",
    });
  }
}
