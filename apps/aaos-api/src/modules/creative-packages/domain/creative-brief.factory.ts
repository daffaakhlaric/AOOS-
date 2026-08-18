import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import {
  CreativeBrief,
  CreativeBriefId,
  type AdAngle,
  type CreativeFormat as BriefRequestFormat,
  type TargetPersona,
} from "@aos/meta-ads-agent";
import type { Branch } from "@aos/meta-ads-connector";

import type { CreativePackageFormat, StoredCreativePackage } from "./creative-package.js";

/**
 * The two `CreativeBrief.formats` sets a "Video + Gambar" / "Gambar saja" choice maps onto.
 *
 * `CreativeBrief.formats` is typed `CreativeFormat[]` in `@aos/meta-ads-agent`
 * (`"VIDEO_15S" | "VIDEO_30S" | "IMAGE_SQUARE" | "IMAGE_STORY"`) and is REALLY READ by
 * `@aos/creative-agent`'s `FormatDecider`: a `VIDEO_15S`/`VIDEO_30S` member is what makes it
 * consider `VIDEO_AND_IMAGES` at all, and it picks the video's duration (15s vs 30s) and the
 * aspect ratio (`IMAGE_STORY` ⇒ vertical) from these members. So the mapping below is not
 * decoration — it is the real input that decides what Kie AI is asked to produce.
 *
 * The dashboard exposes the two-value package-level choice instead of these four tags because the
 * package-level decision is what actually varies in DSS Motor's workflow (spend video credits or
 * not), and `FormatDecider` may still downgrade to `IMAGES_ONLY` when a unit has no source photos.
 */
const BRIEF_FORMATS: Readonly<Record<CreativePackageFormat, readonly BriefRequestFormat[]>> = {
  VIDEO_AND_IMAGES: ["VIDEO_15S", "IMAGE_SQUARE"],
  IMAGES_ONLY: ["IMAGE_SQUARE"],
};

/**
 * Brief fields with no per-brief producer anywhere in this codebase. Rather than invent a
 * plausible-looking value per request, these reuse the exact literals
 * `@aos/meta-ads-agent`'s own real `CreativeBriefBuilder` already writes onto every
 * Tamara-generated brief — so a manually-composed brief and a Tamara-composed one carry identical,
 * already-established values here instead of two different fabrications.
 */
const BRIEF_TONE = "casual, relatable, tidak formal";
const BRIEF_AVOID: readonly string[] = ["terlalu banyak text", "angle harga saja"];
/**
 * Deliberately NOT a fabricated percentage: nothing in this app estimates the impact of refreshing
 * a specific creative, and `CreativeBriefBuilder`'s own "target -40% Rp/D3" is its own hardcoded
 * copy, not a computed figure. An honest placeholder is used here and this field is never surfaced
 * in the dashboard.
 */
const BRIEF_ESTIMATED_IMPACT = "Belum diestimasi";

export interface BuildCreativeBriefInput {
  readonly pkg: StoredCreativePackage;
  readonly createdAt: Date;
}

/**
 * Builds the REAL `CreativeBrief` aggregate `@aos/creative-agent`'s `ProcessCreativeBrief`
 * consumes. Goes through `CreativeBrief.create`'s real validation (never a cast): `adId`, `unit`,
 * `branch`, `angle`, `targetPersona`, `primaryMessage`, `formats` and `reason` are all checked
 * there, so an invalid persisted package fails loudly here rather than silently reaching Kie AI.
 *
 * `adId` falls back to the package's own id for a manual brief — `CreativeBrief.adId` is a
 * required non-empty string used purely as provenance (Kai never calls Meta with it), and a manual
 * brief genuinely has no originating ad.
 */
export function buildCreativeBrief(
  input: BuildCreativeBriefInput,
): Result<CreativeBrief, ValidationError> {
  const { pkg } = input;
  const briefIdResult = CreativeBriefId.create(pkg.briefId);
  if (!briefIdResult.ok) {
    return briefIdResult;
  }
  return CreativeBrief.create({
    id: briefIdResult.value,
    adId: pkg.adId ?? pkg.id,
    unit: pkg.unit,
    // REAL BUG FIX: without this, `AutomotivePromptBuilder` had no human-readable name and
    // interpolated the scraped identityKey/slug straight into the Kie AI prompt (see
    // `CreativeBrief.unitModel`'s docstring for the full story).
    ...(pkg.unitModel !== undefined ? { unitModel: pkg.unitModel } : {}),
    branch: pkg.branch as Branch,
    angle: pkg.angle as AdAngle,
    targetPersona: pkg.targetPersona as TargetPersona,
    primaryMessage: pkg.primaryMessage,
    tone: BRIEF_TONE,
    avoid: BRIEF_AVOID,
    formats: BRIEF_FORMATS[pkg.requestedFormat],
    reason: pkg.reason,
    urgency: pkg.urgency,
    estimatedImpactIfRefreshed: BRIEF_ESTIMATED_IMPACT,
    createdAt: input.createdAt,
  });
}

/** Re-exported so the service and its tests share one source for the mapping. */
export { BRIEF_FORMATS };
