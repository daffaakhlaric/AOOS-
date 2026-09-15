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
  /** Whole-Rupiah listing price (K3 enrichment) — real `Listing.price`, when present. `PropertyCopyBuilder` interpolates it (via `@aos/meta-ads-connector`'s `formatIDR`) only into angles where a price actually reads naturally (`DP_RINGAN`/`PROMO_TERBATAS`/`INVESTASI`); omitted entirely (never "undefined"/"NaN") when absent. */
  readonly price?: number;
  /** Real `Listing.city`, when present (K3 enrichment) — interpolated into `PropertyCopyBuilder`'s location-context phrasing. Omitted entirely when absent. */
  readonly city?: string;
  /**
   * Kai Creative Engine Sprint 3 — real reasoning behind why THIS angle was scored strongest for
   * this listing (`@aos/creative-agent`'s own `scorePropertyAdAngleStrength`'s `reasoning`, when the
   * caller ran it). `undefined` when the angle came from elsewhere (LLM brief generation, a manual
   * pick) — never fabricated. Same "presence alone nudges a fixed English clause, Indonesian text
   * never interpolated raw" discipline `highlights` already establishes (see
   * `PropertyPromptBuilder.hasHighlights`'s doc) — this field's Indonesian VALUE is never
   * interpolated into the English prompt, only its presence is read.
   */
  readonly angleReasoning?: string;
}

/** Port (Hexagonal Architecture) for Kai's PROPERTY-vertical Kie AI prompt generation. The only implementation is `intelligence/PropertyPromptBuilder.ts` — deterministic template rendering, no LLM calls, same discipline as `IPromptBuilder`. */
export interface IPropertyPromptBuilder {
  buildVideoPrompt(brief: PropertyCreativeBrief, sourcePhotoAvailable: boolean): string;
  buildImagePrompt(
    brief: PropertyCreativeBrief,
    variantIndex: number,
    sourcePhotoAvailable: boolean,
  ): string;
}
