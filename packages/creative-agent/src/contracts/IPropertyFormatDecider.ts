import type { CreativeFormat } from "../domain/value-objects/CreativeFormat.js";
import type { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import type { VideoSpec } from "../domain/value-objects/VideoSpec.js";

import type { PropertyCreativeBrief } from "./IPropertyPromptBuilder.js";

/**
 * Port (Hexagonal Architecture) for Kai's PROPERTY-vertical format decision — the PROPERTY
 * sibling to `IFormatDecider`. Deliberately its OWN interface rather than a generic
 * `IFormatDecider<TBrief>`: `IFormatDecider` is hard-typed to `@aos/meta-ads-agent`'s
 * `CreativeBrief` (`.formats`/`.urgency`) across this package's real application-layer wiring
 * (`FormatDecisionService`), and `PropertyCreativeBrief` has neither field (see
 * `IPropertyPromptBuilder.ts`'s docstring for why it stays a separate, simpler struct). The only
 * implementation is `intelligence/PropertyFormatDecider.ts` — deterministic, no randomness, no
 * LLM calls, same discipline as `IFormatDecider`.
 */
export interface IPropertyFormatDecider {
  decideFormat(brief: PropertyCreativeBrief, availablePhotos: number): CreativeFormat;
  decideVideoSpec(brief: PropertyCreativeBrief): VideoSpec;
  decideImageSpec(brief: PropertyCreativeBrief): ImageSpec;
}
