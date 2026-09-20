/**
 * PROMPT 61 — VIDEO STORYBOARD (real spec text, verbatim from the master spec transcript):
 *
 * ```text
 * Default 15s:
 * 0–2 sec   Hook
 * 2–5       Property reveal
 * 5–9       Benefit
 * 9–12      Proof
 * 12–15     CTA
 *
 * Scene structure:
 * {
 *   "scene": 1,
 *   "startSec": 0,
 *   "endSec": 2,
 *   "assetId": "",
 *   "shot": "",
 *   "motion": "",
 *   "overlay": "",
 *   "voiceOver": "",
 *   "transition": ""
 * }
 * ```
 *
 * HONEST DEGRADE (see `PropertyVideoStoryboardBuilder.ts`'s own doc for the full reasoning):
 * Kie AI's real Veo generation endpoints (`VeoGenerateFromTextPayload`/`VeoGenerateFromImagePayload`
 * in `@aos/creative-connector`) accept exactly ONE `prompt: string` field — there is no multi-scene
 * or clip-stitching capability in this codebase's real infrastructure (no `ffmpeg`/video-compositing
 * dependency anywhere in the monorepo). This type is therefore a STRUCTURING/PLANNING layer only: a
 * deterministic breakdown of the real decided video duration into 5 real time-boxed beats with real
 * directorial guidance, which then gets serialized into the ONE real prompt string Kie AI actually
 * receives (`PropertyVideoStoryboardBuilder.serializeToPrompt`) — never a claim of real per-scene
 * generation.
 *
 * `overlay` and `voiceOver` are PLANNING/DIRECTION metadata only — this codebase has no real
 * video-text-overlay compositing (`creative-image-overlay.ts` composites onto IMAGES only) and no
 * real text-to-speech/audio-generation capability. Those two fields describe what SHOULD appear at
 * that beat for a future phase to actually render — they are never sent to Kie AI's generation API
 * and never claimed to be actually rendered today.
 */
export enum VideoStoryboardBeatName {
  HOOK = "HOOK",
  PROPERTY_REVEAL = "PROPERTY_REVEAL",
  BENEFIT = "BENEFIT",
  PROOF = "PROOF",
  CTA = "CTA",
}

/** The spec's real 5 beats, in their real declared order (0-2s / 2-5s / 5-9s / 9-12s / 12-15s for the default 15s duration). */
export const ALL_VIDEO_STORYBOARD_BEATS: readonly VideoStoryboardBeatName[] = [
  VideoStoryboardBeatName.HOOK,
  VideoStoryboardBeatName.PROPERTY_REVEAL,
  VideoStoryboardBeatName.BENEFIT,
  VideoStoryboardBeatName.PROOF,
  VideoStoryboardBeatName.CTA,
];

/**
 * One beat of a `VideoStoryboard` — mirrors the spec's real JSON scene-structure sample field names
 * exactly (`scene`, `startSec`, `endSec`, `assetId`, `shot`, `motion`, `overlay`, `voiceOver`,
 * `transition`), plus a `beat` discriminant this codebase adds to identify which of the 5 real named
 * beats (Hook/Property reveal/Benefit/Proof/CTA) this scene is.
 */
export interface VideoStoryboardScene {
  /** 1-based scene number, per the spec's own JSON sample (`"scene": 1`). */
  readonly scene: number;
  readonly beat: VideoStoryboardBeatName;
  readonly startSec: number;
  readonly endSec: number;
  /**
   * Always `""` today — there is no real per-scene asset-selection infrastructure in
   * `creative-agent` yet (a single brief/source-photo drives one whole-video generation, not a
   * per-beat asset pick). Honestly typed as a placeholder for a future phase, never fabricated.
   */
  readonly assetId: string;
  readonly shot: string;
  readonly motion: string;
  /** PLANNING/DIRECTION metadata only — see this file's top-level doc. Never actually rendered today. */
  readonly overlay: string;
  /** PLANNING/DIRECTION metadata only — see this file's top-level doc. Never actually synthesized today. */
  readonly voiceOver: string;
  readonly transition: string;
}

/** A full 5-beat storyboard for one real decided video duration (8s/15s/30s — see `FormatDecider`/`PropertyFormatDecider`). */
export interface VideoStoryboard {
  readonly durationSeconds: number;
  readonly scenes: readonly VideoStoryboardScene[];
}
