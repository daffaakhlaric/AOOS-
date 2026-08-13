import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { CopyVariantGenerated } from "./CopyVariantGenerated.js";
import type { CreativeGenerationFailed } from "./CreativeGenerationFailed.js";
import type { CreativeGenerationStarted } from "./CreativeGenerationStarted.js";
import type { CreativePackageReady } from "./CreativePackageReady.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for all 4 named events (spec "Domain — events/"),
 * mirroring `@aos/sales-agent`'s `JessyAgentEvents` / `@aos/ai-judge`'s `AiJudgeEvents` convention
 * exactly.
 */
export class CreativeAgentEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/creative-agent",
  ) {}

  async publishCreativeGenerationStarted(payload: CreativeGenerationStarted): Promise<void> {
    await this.publish(
      "aaos.creative.generation.started",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishCreativePackageReady(payload: CreativePackageReady): Promise<void> {
    await this.publish(
      "aaos.creative.package.ready",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishCreativeGenerationFailed(payload: CreativeGenerationFailed): Promise<void> {
    await this.publish(
      "aaos.creative.generation.failed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishCopyVariantGenerated(payload: CopyVariantGenerated): Promise<void> {
    await this.publish(
      "aaos.creative.copy-variant.generated",
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
      producer: "@aos/creative-agent",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
