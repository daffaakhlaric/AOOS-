import type {
  IPropertyPromptBuilder,
  PropertyCreativeBrief,
} from "../contracts/IPropertyPromptBuilder.js";

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
