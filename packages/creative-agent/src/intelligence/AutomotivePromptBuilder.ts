import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { IPromptBuilder } from "../contracts/IPromptBuilder.js";

import { AngleToPromptMapper } from "./AngleToPromptMapper.js";

/** REAL BUG FIX: `brief.unit` is the scraped identityKey/slug (e.g. "toyota-avanza-g-2023-66e041ab"), not a readable name — see `CreativeBrief.unitModel`'s docstring. Prefers the real human-readable model name and only falls back to the slug when no scraped match exists. */
function describeCar(brief: CreativeBrief): string {
  return brief.unitModel ?? brief.unit;
}

/**
 * Builds English Kie AI prompts for automotive video/image generation (spec "Automotive Prompt
 * Builder"). ALL output is English — Kai translates the Indonesian `CreativeBrief` into English
 * Kie AI prompts by design: the car description (`describeCar(brief)`, real model name — e.g.
 * "Xpander Cross 2019" — with a raw-slug fallback) and `brief.branch` (a place name, e.g.
 * `BINTARO`) are already language-neutral, so they're safe to interpolate directly;
 * Indonesian-language fields (`primaryMessage`, `tone`, `avoid`, `uspMessages`) are deliberately
 * NEVER interpolated raw into these prompts to guarantee the English-only invariant
 * `PromptQuality.spec.ts` pins.
 *
 * COORDINATOR NOTE #4 applied: `brief.uspMessages` (Samantha's `ANGLE_USP_MAP` selection, carried
 * "for Kai's convenience") is Indonesian-language text, so it cannot be inlined into an
 * English-only prompt without breaking that invariant. Instead, its mere PRESENCE nudges the
 * prompt with a fixed, generic English clause ("emphasizing verified quality and buyer trust") —
 * using the signal Samantha sent (this brief has known USPs worth emphasizing) without leaking her
 * Indonesian phrasing. `CopyBuilder` (Indonesian output) is where `uspMessages`' actual text is used.
 */
export class AutomotivePromptBuilder implements IPromptBuilder {
  buildVideoPrompt(brief: CreativeBrief, sourcePhotoAvailable: boolean): string {
    const style = AngleToPromptMapper.styleFor(brief.angle);
    const branchLabel = formatBranchLabel(brief.branch);
    const uspClause = hasUspMessages(brief) ? ", emphasizing verified quality and buyer trust" : "";
    const sourceClause = sourcePhotoAvailable ? "" : ", generated from text description only";

    return (
      `Professional car advertisement video, ${describeCar(brief)} in modern Indonesian car showroom, ` +
      `${style}${uspClause}, natural soft lighting, smooth camera movement, ` +
      `clean white background, 4K quality, no text overlay, ` +
      `${branchLabel} city backdrop, premium automotive photography style${sourceClause}`
    );
  }

  buildImagePrompt(brief: CreativeBrief, variantIndex: number): string {
    const style = AngleToPromptMapper.styleFor(brief.angle);
    const uspClause = hasUspMessages(brief) ? ", emphasizing verified quality and buyer trust" : "";

    return (
      `Professional automotive photography, ${describeCar(brief)}, Mobix by DSS Motor showroom, ` +
      `${style}${uspClause}, variant ${variantIndex + 1}, natural lighting, sharp focus, ` +
      `clean background, Instagram-ready composition, no watermark`
    );
  }
}

function hasUspMessages(brief: CreativeBrief): boolean {
  return brief.uspMessages !== undefined && brief.uspMessages.length > 0;
}

/** `Branch` enum values are already language-neutral place names (`BINTARO`, `CINERE`, ...) — this only title-cases them for prompt readability, e.g. `"BINTARO"` -> `"Bintaro"`. */
function formatBranchLabel(branch: string): string {
  const lower = branch.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
