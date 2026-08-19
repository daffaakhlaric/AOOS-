import type { PropertyAdAngle } from "../domain/value-objects/PropertyAdAngle.js";

/**
 * The PROPERTY vertical's sibling to `CreativeBrief` (spec Part 5's Kai "Buat Manual" property
 * form fields — listing dropdown, angle, WA auto-fill from `listing.waNumber`). Deliberately a
 * plain, already-validated struct — see `PropertyAdAngle.ts`'s docstring for why this doesn't
 * reuse `@aos/meta-ads-agent`'s `CreativeBrief` entity.
 */
export interface PropertyCreativeBrief {
  readonly listingId: string;
  readonly listingTitle: string;
  readonly propertyType: string;
  readonly angle: PropertyAdAngle;
  readonly branch?: string;
  readonly waNumber?: string;
  /** Free-text highlights carried "for Kai's convenience", same role `CreativeBrief.uspMessages` plays for automotive — Indonesian-language, so (per `PropertyPromptBuilder`'s docstring) never interpolated raw into the English-only prompt. */
  readonly highlights?: readonly string[];
}

/** Port (Hexagonal Architecture) for Kai's PROPERTY-vertical Kie AI prompt generation. The only implementation is `intelligence/PropertyPromptBuilder.ts` — deterministic template rendering, no LLM calls, same discipline as `IPromptBuilder`. */
export interface IPropertyPromptBuilder {
  buildVideoPrompt(brief: PropertyCreativeBrief, sourcePhotoAvailable: boolean): string;
  buildImagePrompt(brief: PropertyCreativeBrief, variantIndex: number): string;
}
