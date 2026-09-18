import type {
  IPropertyPromptBuilder,
  PropertyCreativeBrief,
} from "../contracts/IPropertyPromptBuilder.js";
import {
  decidePropertyIntegrityMode,
  PropertyIntegrityMode,
} from "../domain/value-objects/PropertyIntegrityMode.js";

import { PropertyAngleToPromptMapper } from "./PropertyAngleToPromptMapper.js";

/**
 * Builds English Kie AI prompts for PROPERTY-vertical video/image generation (spec Part 5) — the
 * PROPERTY sibling to `AutomotivePromptBuilder`, wired the exact same way: ALL output is English,
 * deterministic template rendering (no LLM calls), and Indonesian-language fields
 * (`brief.highlights`) are never interpolated raw — their mere presence nudges the prompt with a
 * fixed English clause instead, same discipline `AutomotivePromptBuilder.hasUspMessages` documents.
 */
export class PropertyPromptBuilder implements IPropertyPromptBuilder {
  buildVideoPrompt(brief: PropertyCreativeBrief, sourcePhotoAvailable: boolean): string {
    const style = PropertyAngleToPromptMapper.styleFor(brief.angle);
    const highlightsClause = hasHighlights(brief)
      ? ", emphasizing verified quality and buyer confidence"
      : "";
    const angleReasoningClause = hasAngleReasoning(brief)
      ? ", grounded in a specific, data-backed property strength"
      : "";
    const sourceClause = sourcePhotoAvailable ? "" : ", generated from text description only";

    // PROMPT 46 — PROPERTY INTEGRITY MODES. A CONCEPTUAL listing (real, honest `TANAH`/land
    // `propertyType`, or an unrecognized one — see `decidePropertyIntegrityMode`'s own doc) must
    // never be prompted the same "photoreal advertisement of an existing, ready unit" way a real
    // built unit (STRICT) is — that would generate a finished-looking building for land that does
    // not exist yet, misleading a prospective buyer. This branch swaps the entire scene description
    // for an explicitly conceptual/illustrative one; the model is told in plain words this is NOT a
    // photograph of an existing finished building.
    if (decidePropertyIntegrityMode(brief.propertyType) === PropertyIntegrityMode.CONCEPTUAL) {
      const anchorClause = sourcePhotoAvailable
        ? "Using the attached reference photo as the real land plot/site context only (do not depict a different location), "
        : "";
      return (
        `${anchorClause}Conceptual architectural visualization video of a future property ` +
        `development on this land — explicitly a non-photographic, illustrative rendering, NOT a ` +
        `video of an existing finished building, ${describeProperty(brief)}, ` +
        `${style}${highlightsClause}${angleReasoningClause}, clean architectural visualization ` +
        `style, natural soft lighting, smooth camera movement, 4K quality, no text overlay${sourceClause}`
      );
    }

    return (
      `Professional real estate advertisement video, ${describeProperty(brief)}, ` +
      `${style}${highlightsClause}${angleReasoningClause}, natural soft lighting, ` +
      `smooth camera movement, elegant architectural photography, 4K quality, no text overlay${sourceClause}`
    );
  }

  buildImagePrompt(
    brief: PropertyCreativeBrief,
    variantIndex: number,
    sourcePhotoAvailable: boolean,
  ): string {
    const style = PropertyAngleToPromptMapper.styleFor(brief.angle);
    const highlightsClause = hasHighlights(brief)
      ? ", emphasizing verified quality and buyer confidence"
      : "";
    const angleReasoningClause = hasAngleReasoning(brief)
      ? ", grounded in a specific, data-backed property strength"
      : "";

    // PROMPT 46 — PROPERTY INTEGRITY MODES (see `buildVideoPrompt`'s own doc for the full
    // reasoning). CONCEPTUAL never gets the "Professional real estate photography" framing STRICT
    // gets below — that phrasing asks the model for a photoreal picture of a real, existing unit,
    // which land/an unrecognized listing genuinely is not. The generated image ALSO carries a real
    // "ILUSTRASI" disclosure label composited on top downstream (`creative-image-overlay.ts`) —
    // this prompt-level change and that compositing-level label are deliberately independent, each
    // honest on its own even if the other step were ever skipped.
    if (decidePropertyIntegrityMode(brief.propertyType) === PropertyIntegrityMode.CONCEPTUAL) {
      const anchorClause = sourcePhotoAvailable
        ? "Using the attached reference photo as the real land plot/site context only (same location — do not depict a different one), "
        : "";
      return (
        `${anchorClause}Conceptual architectural illustration of a future property development ` +
        `on this land — explicitly a non-photographic, illustrative rendering, NOT a photograph of ` +
        `an existing finished building, ${describeProperty(brief)}, ` +
        `${style}${highlightsClause}${angleReasoningClause}, variant ${variantIndex + 1}, ` +
        `clean architectural visualization style, bright and inviting composition, no watermark`
      );
    }

    // REAL BUG FIX (live-confirmed, 2026-09-15): the real reference photo (`image_input`) WAS
    // reaching Kie AI's nano-banana-pro endpoint (the earlier field-name bug, fixed separately),
    // but the prompt text never told the model to actually BASE its output on that photo — a
    // generic "Professional real estate photography, <listing>, <style>" description reads as an
    // instruction to generate a NEW scene from scratch, not to edit/enhance the attached one. Kai
    // generated a completely different, unrelated scene every time despite a real photo being
    // attached (live-confirmed: same listing, same angle, output bore no resemblance to the real
    // reference photo). This anchoring clause is prepended ONLY when a real source photo is
    // actually attached — never fabricated when generation is honestly text-only.
    const anchorClause = sourcePhotoAvailable
      ? "Using the attached reference photo as the exact base scene (same property, same angle, same composition — do not replace it with a different location), "
      : "";

    return (
      `${anchorClause}Professional real estate photography, ${describeProperty(brief)}, ` +
      `${style}${highlightsClause}${angleReasoningClause}, variant ${variantIndex + 1}, ` +
      `natural lighting, sharp focus, bright and inviting composition, no watermark`
    );
  }
}

function hasHighlights(brief: PropertyCreativeBrief): boolean {
  return brief.highlights !== undefined && brief.highlights.length > 0;
}

/**
 * Kai Creative Engine Sprint 3 — `angleReasoning`'s Indonesian VALUE is never interpolated (same
 * discipline `hasHighlights` already establishes for `brief.highlights`); only its presence nudges
 * the English prompt with a fixed clause.
 */
function hasAngleReasoning(brief: PropertyCreativeBrief): boolean {
  return brief.angleReasoning !== undefined && brief.angleReasoning.length > 0;
}

function describeProperty(brief: PropertyCreativeBrief): string {
  return `${brief.listingTitle} (${brief.propertyType.toLowerCase()})`;
}
