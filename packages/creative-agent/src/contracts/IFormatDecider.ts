import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { CreativeFormat } from "../domain/value-objects/CreativeFormat.js";
import type { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import type { VideoSpec } from "../domain/value-objects/VideoSpec.js";

/** Port (Hexagonal Architecture) for Kai's format decision (spec "Format Decision Logic"). The only implementation is `intelligence/FormatDecider.ts` — deterministic, no randomness, no LLM calls. */
export interface IFormatDecider {
  decideFormat(brief: CreativeBrief, availablePhotos: number): CreativeFormat;
  decideVideoSpec(brief: CreativeBrief): VideoSpec;
  decideImageSpec(brief: CreativeBrief): ImageSpec;
}
