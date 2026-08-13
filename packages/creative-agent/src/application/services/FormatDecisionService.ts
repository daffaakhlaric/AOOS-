import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { IFormatDecider } from "../../contracts/IFormatDecider.js";
import { CreativeFormat } from "../../domain/value-objects/CreativeFormat.js";
import type { ImageSpec } from "../../domain/value-objects/ImageSpec.js";
import type { VideoSpec } from "../../domain/value-objects/VideoSpec.js";

export interface FormatDecision {
  readonly format: CreativeFormat;
  readonly videoSpec?: VideoSpec;
  readonly imageSpec: ImageSpec;
}

/** Application-layer wrapper (spec "application/services/FormatDecisionService.ts") over `IFormatDecider` — bundles the format + its concrete specs into one call so `KaiAgentService` doesn't have to sequence 3 separate calls itself. */
export class FormatDecisionService {
  constructor(private readonly formatDecider: IFormatDecider) {}

  decide(brief: CreativeBrief, availablePhotos: number): FormatDecision {
    const format = this.formatDecider.decideFormat(brief, availablePhotos);
    const imageSpec = this.formatDecider.decideImageSpec(brief);
    const videoSpec =
      format === CreativeFormat.VIDEO_AND_IMAGES
        ? this.formatDecider.decideVideoSpec(brief)
        : undefined;

    return { format, videoSpec, imageSpec };
  }
}
