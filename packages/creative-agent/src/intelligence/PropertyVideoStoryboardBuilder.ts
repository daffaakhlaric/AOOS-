import type { PropertyCreativeBrief } from "../contracts/IPropertyPromptBuilder.js";
import {
  decidePropertyIntegrityMode,
  PropertyIntegrityMode,
} from "../domain/value-objects/PropertyIntegrityMode.js";
import {
  ALL_VIDEO_STORYBOARD_BEATS,
  VideoStoryboardBeatName,
} from "../domain/value-objects/VideoStoryboard.js";
import type {
  VideoStoryboard,
  VideoStoryboardScene,
} from "../domain/value-objects/VideoStoryboard.js";

import { PropertyAngleToPromptMapper } from "./PropertyAngleToPromptMapper.js";

/**
 * PROMPT 61 — VIDEO STORYBOARD. See `VideoStoryboard.ts`'s own doc for the real spec text and the
 * honest-degrade reasoning (Kie AI's real Veo endpoints accept exactly ONE `prompt: string` — see
 * `@aos/creative-connector`'s `VeoGenerateFromTextPayload`/`VeoGenerateFromImagePayload` — and this
 * monorepo has no video-compositing/clip-stitching dependency anywhere, confirmed by inspecting
 * every `package.json` under `packages/creative-connector` and `apps/aaos-api` for `ffmpeg` or
 * similar — so a real per-scene-generated, stitched video is not honestly buildable this phase).
 *
 * This class is therefore a pure STRUCTURING/PLANNING layer, deliberately separate from
 * `PropertyPromptBuilder`: it never modifies that class's existing `buildVideoPrompt` behavior (zero
 * regression risk to any existing caller) and is wired as a new, opt-in alternative a caller reaches
 * for explicitly when it wants a storyboard-structured prompt instead of `buildVideoPrompt`'s flat
 * single-sentence one.
 *
 * `buildStoryboard` takes the exact same real inputs `PropertyPromptBuilder.buildVideoPrompt`
 * already has (`PropertyCreativeBrief`, `sourcePhotoAvailable`) plus the real decided
 * `durationSeconds` (`VideoSpec.durationSeconds`, as `FormatDecider`/`PropertyFormatDecider` already
 * compute it — 8/15/30) and deterministically time-boxes it into the spec's real 5 named beats
 * (Hook / Property reveal / Benefit / Proof / CTA), each carrying real, angle-appropriate
 * directorial guidance (reusing `PropertyAngleToPromptMapper.styleFor`, the same style fragment
 * `buildVideoPrompt` itself uses). `serializeToPrompt` then folds that structure into ONE real
 * prompt string — the only thing Kie AI's real API can actually receive — giving the generation
 * model explicit temporal/directorial sequencing a flat sentence never could.
 */
export class PropertyVideoStoryboardBuilder {
  buildStoryboard(
    brief: PropertyCreativeBrief,
    durationSeconds: number,
    sourcePhotoAvailable: boolean,
  ): VideoStoryboard {
    const boundaries = computeBeatBoundaries(durationSeconds);
    const isConceptual =
      decidePropertyIntegrityMode(brief.propertyType) === PropertyIntegrityMode.CONCEPTUAL;
    const style = PropertyAngleToPromptMapper.styleFor(brief.angle);
    const highlightsPresent = hasHighlights(brief);
    const angleReasoningPresent = hasAngleReasoning(brief);

    const scenes: VideoStoryboardScene[] = ALL_VIDEO_STORYBOARD_BEATS.map((beat, index) => {
      const startSec = index === 0 ? 0 : (boundaries[index - 1] ?? 0);
      const endSec = boundaries[index] ?? durationSeconds;
      const content = beatContent(beat, {
        brief,
        isConceptual,
        sourcePhotoAvailable,
        style,
        highlightsPresent,
        angleReasoningPresent,
      });
      return {
        scene: index + 1,
        beat,
        startSec,
        endSec,
        assetId: "",
        ...content,
      };
    });

    return { durationSeconds, scenes };
  }

  /**
   * Folds a `VideoStoryboard` into ONE real Kie AI prompt string — the same tail clauses
   * (angle style / highlights / angleReasoning / integrity-mode framing / source-photo clause) that
   * `PropertyPromptBuilder.buildVideoPrompt` uses, but with the body replaced by an explicit
   * beat-by-beat sequence instead of one flat descriptive sentence. `overlay`/`voiceOver` are
   * deliberately NEVER included here — see `VideoStoryboard.ts`'s doc: they are planning metadata
   * only, and this codebase has neither real video-text-overlay compositing nor real
   * text-to-speech, so asking the generation model to render them would be dishonest and would risk
   * garbled on-screen text Kie AI cannot actually be told not to render.
   */
  serializeToPrompt(
    storyboard: VideoStoryboard,
    brief: PropertyCreativeBrief,
    sourcePhotoAvailable: boolean,
  ): string {
    const style = PropertyAngleToPromptMapper.styleFor(brief.angle);
    const highlightsClause = hasHighlights(brief)
      ? ", emphasizing verified quality and buyer confidence"
      : "";
    const angleReasoningClause = hasAngleReasoning(brief)
      ? ", grounded in a specific, data-backed property strength"
      : "";
    const sourceClause = sourcePhotoAvailable ? "" : ", generated from text description only";
    const beatsText = storyboard.scenes
      .map(
        (scene) =>
          `${scene.startSec}-${scene.endSec}s (${beatLabel(scene.beat)}): ${scene.shot}, ${scene.motion}`,
      )
      .join("; ");

    const isConceptual =
      decidePropertyIntegrityMode(brief.propertyType) === PropertyIntegrityMode.CONCEPTUAL;

    if (isConceptual) {
      const anchorClause = sourcePhotoAvailable
        ? "Using the attached reference photo as the real land plot/site context only (do not depict a different location), "
        : "";
      return (
        `${anchorClause}Conceptual architectural visualization video of a future property ` +
        `development on this land — explicitly a non-photographic, illustrative rendering, NOT a ` +
        `video of an existing finished building, structured as a 5-beat storyboard: ${beatsText}, ` +
        `${describeProperty(brief)}, ${style}${highlightsClause}${angleReasoningClause}, clean ` +
        `architectural visualization style, natural soft lighting, smooth camera movement, 4K ` +
        `quality, no text overlay${sourceClause}`
      );
    }

    return (
      `Professional real estate advertisement video structured as a 5-beat storyboard: ${beatsText}, ` +
      `${describeProperty(brief)}, ${style}${highlightsClause}${angleReasoningClause}, natural soft ` +
      `lighting, smooth camera movement, elegant architectural photography, 4K quality, no text ` +
      `overlay${sourceClause}`
    );
  }
}

/**
 * The spec's real beat boundary fractions for the default 15s duration (0-2 / 2-5 / 5-9 / 9-12 /
 * 12-15), expressed as cumulative fractions of the total duration (2/15, 5/15, 9/15, 12/15, 1) so
 * the same 5-beat proportions apply honestly to the OTHER two real durations this codebase actually
 * decides (`FormatDecider`/`PropertyFormatDecider`: 8s and 30s) — not just the spec's own literal
 * 15s example.
 */
const CUMULATIVE_BEAT_FRACTIONS: readonly number[] = [2 / 15, 5 / 15, 9 / 15, 12 / 15, 1];

/**
 * Turns the spec's real cumulative beat fractions into real integer-second boundaries for any real
 * decided `durationSeconds` (8/15/30). Rounds each cumulative fraction to the nearest second, forces
 * the final boundary to equal `durationSeconds` exactly (absorbing rounding remainder into the CTA
 * beat, never truncating the video short), and clamps any boundary that would otherwise fall behind
 * its predecessor (never happens for the 3 real durations this codebase decides, but keeps the
 * function honest for any other positive duration a future caller might pass).
 */
function computeBeatBoundaries(durationSeconds: number): number[] {
  const boundaries = CUMULATIVE_BEAT_FRACTIONS.map((fraction) =>
    Math.round(fraction * durationSeconds),
  );
  boundaries[boundaries.length - 1] = durationSeconds;
  for (let i = 1; i < boundaries.length; i += 1) {
    const previous = boundaries[i - 1] ?? 0;
    const current = boundaries[i] ?? previous;
    boundaries[i] = current < previous ? previous : current;
  }
  return boundaries;
}

function beatLabel(beat: VideoStoryboardBeatName): string {
  switch (beat) {
    case VideoStoryboardBeatName.HOOK:
      return "Hook";
    case VideoStoryboardBeatName.PROPERTY_REVEAL:
      return "Property reveal";
    case VideoStoryboardBeatName.BENEFIT:
      return "Benefit";
    case VideoStoryboardBeatName.PROOF:
      return "Proof";
    case VideoStoryboardBeatName.CTA:
      return "CTA";
  }
}

interface BeatContentContext {
  readonly brief: PropertyCreativeBrief;
  readonly isConceptual: boolean;
  readonly sourcePhotoAvailable: boolean;
  readonly style: string;
  readonly highlightsPresent: boolean;
  readonly angleReasoningPresent: boolean;
}

interface BeatContent {
  readonly shot: string;
  readonly motion: string;
  readonly overlay: string;
  readonly voiceOver: string;
  readonly transition: string;
}

/** No real TTS/audio-generation capability exists — every `voiceOver` field says so explicitly. */
const NO_TTS_NOTE = "no real TTS synthesis yet";

function beatContent(beat: VideoStoryboardBeatName, ctx: BeatContentContext): BeatContent {
  const { brief, isConceptual, style, highlightsPresent, angleReasoningPresent } = ctx;

  switch (beat) {
    case VideoStoryboardBeatName.HOOK:
      return {
        shot: isConceptual
          ? `Attention-grabbing opening shot of the land/site (conceptual framing, not an existing finished building), setting up ${brief.listingTitle}`
          : `Attention-grabbing opening shot of ${brief.listingTitle}, immediate visual hook`,
        motion: "quick push-in / snap-zoom to interrupt the scroll",
        overlay: `Planning note: hook headline overlay placeholder introducing ${brief.listingTitle}`,
        voiceOver: `Planning note: short punchy opening voice line (${NO_TTS_NOTE})`,
        transition: "quick cut",
      };
    case VideoStoryboardBeatName.PROPERTY_REVEAL:
      return {
        shot: isConceptual
          ? "Conceptual reveal shot of the future development rendering, explicitly illustrative, not a photograph of an existing finished building"
          : `Smooth reveal shot showcasing ${describeProperty(brief)}, ${style}`,
        motion: "smooth glide/pan reveal",
        overlay: "Planning note: property name + core promise overlay placeholder",
        voiceOver: `Planning note: reveal line naming the property and its core promise (${NO_TTS_NOTE})`,
        transition: "match cut",
      };
    case VideoStoryboardBeatName.BENEFIT:
      return {
        shot: `Benefit-focused shot highlighting ${style}${highlightsPresent ? ", emphasizing verified quality and buyer confidence" : ""}`,
        motion: "steady tracking shot across key spaces/features",
        overlay: highlightsPresent
          ? "Planning note: key-benefit bullet overlay placeholder (verified highlights)"
          : "Planning note: key-benefit overlay placeholder",
        voiceOver: `Planning note: benefit voice line covering the property's core selling points (${NO_TTS_NOTE})`,
        transition: "cross dissolve",
      };
    case VideoStoryboardBeatName.PROOF:
      return {
        shot: `Trust/credibility shot${angleReasoningPresent ? ", grounded in a specific, data-backed property strength" : ""}`,
        motion: "gentle static hold or slow pan for credibility",
        overlay:
          "Planning note: proof/trust badge overlay placeholder (e.g. verified listing or testimonial marker)",
        voiceOver: `Planning note: proof line reinforcing trust/credibility (${NO_TTS_NOTE})`,
        transition: "cut",
      };
    case VideoStoryboardBeatName.CTA:
      return {
        shot: "Closing CTA shot — end-card style composition with clear call-to-action framing",
        motion: "settle to static hold",
        overlay: brief.waNumber
          ? "Planning note: CTA overlay placeholder (contact/WhatsApp prompt)"
          : "Planning note: CTA overlay placeholder (contact prompt)",
        voiceOver: `Planning note: closing call-to-action voice line (${NO_TTS_NOTE})`,
        transition: "fade to end card",
      };
  }
}

function hasHighlights(brief: PropertyCreativeBrief): boolean {
  return brief.highlights !== undefined && brief.highlights.length > 0;
}

function hasAngleReasoning(brief: PropertyCreativeBrief): boolean {
  return brief.angleReasoning !== undefined && brief.angleReasoning.length > 0;
}

function describeProperty(brief: PropertyCreativeBrief): string {
  return `${brief.listingTitle} (${brief.propertyType.toLowerCase()})`;
}
