import type { Result } from "@aos/common";
import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { CopyVariant } from "../../domain/entities/CopyVariant.js";
import type { CreativeAgentError } from "../../domain/errors/CreativeAgentError.js";
import type { CreativeAgentEvents } from "../../domain/events/CreativeAgentEvents.js";
import type { CopyBuilder } from "../../intelligence/CopyBuilder.js";

/** Application-layer wrapper (spec "application/services/CopyGenerationService.ts") over `CopyBuilder` — publishes one `CopyVariantGenerated` event per variant after a successful build (spec "Domain — events/CopyVariantGenerated.ts"). */
export class CopyGenerationService {
  constructor(
    private readonly copyBuilder: CopyBuilder,
    private readonly events: CreativeAgentEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async generate(
    brief: CreativeBrief,
    tenantId: string,
    correlationId: string,
  ): Promise<Result<ReadonlyArray<CopyVariant>, CreativeAgentError>> {
    const result = this.copyBuilder.buildVariants(brief);
    if (!result.ok) {
      return result;
    }

    for (const variant of result.value) {
      await this.events.publishCopyVariantGenerated({
        briefId: brief.id.toString(),
        variantLabel: variant.variantLabel,
        angle: variant.angle,
        headline: variant.headline,
        tenantId,
        correlationId,
        occurredAt: this.now(),
        version: "1.0",
      });
    }

    return result;
  }
}
