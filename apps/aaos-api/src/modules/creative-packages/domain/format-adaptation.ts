import type sharpDefault from "sharp";

/**
 * PROMPT 59 — FORMAT ADAPTATION (Phase 38).
 *
 * The spec's own literal wording (verbatim, from the original transcript):
 *   "Generate: 1:1 / 4:5 / 9:16. Recompose per ratio. Do NOT simply resize."
 *
 * HONEST SCOPE — this module is deliberately NOT the spec's full ambition. "Recompose" in the
 * fuller sense the spec envisions means re-running real generative AI per ratio, or intelligently
 * re-cropping around a detected subject (moving/re-flowing the actual composition per target
 * ratio) — this codebase has no subject-detection/smart-crop tooling, and adding one is a large,
 * novel capability out of scope for this phase. What this module DOES build, honestly: given ONE
 * real already-generated base image buffer, produce additional real aspect-ratio VARIANTS via a
 * genuine `sharp` center-crop — geometrically correct (no distortion, no squish), always labeled
 * `technique: "smart_center_crop"` so no caller downstream mistakes this for true AI recomposition.
 * A naive stretch-resize (what the spec explicitly says NOT to do) is never performed anywhere in
 * this module.
 *
 * `4:5` — REAL GAP, DELIBERATELY NOT ADDED TO THE SHARED `AspectRatio` ENUM. The spec verbatim
 * asks for `4:5`, which `@aos/creative-connector`'s `AspectRatio` (`WIDESCREEN 16:9` /
 * `VERTICAL 9:16` / `SQUARE 1:1`) does not have. That enum is shared with real VIDEO generation
 * (`VideoSpec`, `GenerateLongVideo`, `GenerateVideoFromText`) and `CreativeConnectorConfig`'s own
 * hardcoded `z.enum(["16:9", "9:16", "1:1"])` — none of which have any real KIE.ai/Veo video
 * model support for a `4:5` ratio. Adding `PORTRAIT_4_5` there would ripple into video-generation
 * surfaces that cannot honestly honor it. `FormatAdaptationRatio` below is instead a small, LOCAL,
 * purely-geometric type scoped to this module — crop-to-ratio is a plain `sharp` operation with no
 * dependency on what any generation model supports, so `4:5` is genuinely, honestly buildable here
 * without touching the shared generation-facing enum at all.
 *
 * OPT-IN, ZERO DEFAULT BEHAVIOR CHANGE — this function is not called from
 * `creative-packages.service.ts`'s existing generation call chain (`runGenerationProperty` /
 * `runGenerationPropertyWithQaRetry` / `applyOverlayIfRequested`) anywhere. It exists as a
 * standalone capability a future caller COULD use to produce a second/third real image variant
 * from one real base image. Wiring automatic multi-format generation into the default pipeline is
 * explicit future work, left undone here deliberately (see this module's own audit notes).
 *
 * CALL-ORDER NOTE FOR FUTURE CALLERS: if a caller wants BOTH a ratio adaptation AND the
 * `creative-image-overlay.ts` typography overlay on the same image, adapt FIRST, then overlay the
 * ADAPTED buffer — never the reverse. `applyTypographyOverlay` measures the real
 * width/height of whatever buffer it receives (via `sharp().metadata()`) and positions its banner
 * as a fraction of THAT buffer's actual dimensions; overlaying onto the pre-crop image and THEN
 * cropping to a narrower ratio risks slicing the composited price/headline/CTA text clean off the
 * final frame. Cropping first guarantees the overlay — if a caller adds one downstream — is
 * computed for the real, final output dimensions.
 *
 * HONEST DEGRADE: every failure mode (sharp not resolving image dimensions, a corrupt buffer, an
 * encoding exception) returns `{ ok: false, reason }` — it NEVER throws, and NEVER returns a
 * buffer that silently failed to crop, matching the discipline `creative-image-overlay.ts`
 * established.
 */

/**
 * The 3 real ratios PROMPT 59 literally asks for. Purely geometric — see this module's own
 * top-of-file note on why this is intentionally NOT `@aos/creative-connector`'s `AspectRatio`.
 */
export type FormatAdaptationRatio = "1:1" | "4:5" | "9:16";

/** width / height for each `FormatAdaptationRatio`. */
const RATIO_VALUES: Readonly<Record<FormatAdaptationRatio, number>> = {
  "1:1": 1 / 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
};

export type FormatAdaptationResult =
  | {
      readonly ok: true;
      readonly buffer: Buffer;
      readonly width: number;
      readonly height: number;
      /** Always this literal — see module doc: never claimed as true AI recomposition. */
      readonly technique: "smart_center_crop";
    }
  | { readonly ok: false; readonly reason: string };

/**
 * Produces a real, geometrically-correct `targetRatio` variant of `imageBuffer` via a `sharp`
 * center-crop (`sharp().extract()`) — never a stretch/squish resize. The crop keeps the LARGER
 * source dimension intact and trims only the dimension that must shrink to reach `targetRatio`,
 * centered on the source image (no subject detection — a plain geometric center crop, honestly
 * labeled `smart_center_crop`, never "recompose").
 *
 * Returns the real cropped-region pixel dimensions (never upscaled beyond the source) alongside
 * the re-encoded JPEG buffer.
 */
export async function adaptToAspectRatio(
  imageBuffer: Buffer,
  targetRatio: FormatAdaptationRatio,
): Promise<FormatAdaptationResult> {
  let sharpFactory: typeof sharpDefault;
  try {
    sharpFactory = (await import("sharp")).default;
  } catch (caught) {
    return {
      ok: false,
      reason: `sharp_unavailable: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  try {
    const metadata = await sharpFactory(imageBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (width === undefined || height === undefined || width <= 0 || height <= 0) {
      return { ok: false, reason: "unreadable_image_dimensions" };
    }

    const targetAspect = RATIO_VALUES[targetRatio];
    const sourceAspect = width / height;

    let cropWidth = width;
    let cropHeight = height;
    if (sourceAspect > targetAspect) {
      // Source is relatively wider than the target — trim width, keep the full height.
      cropWidth = Math.max(1, Math.round(height * targetAspect));
      cropHeight = height;
    } else if (sourceAspect < targetAspect) {
      // Source is relatively taller than the target — trim height, keep the full width.
      cropHeight = Math.max(1, Math.round(width / targetAspect));
      cropWidth = width;
    }
    // sourceAspect === targetAspect: already the right ratio, crop is a no-op full-frame extract.

    const left = Math.max(0, Math.floor((width - cropWidth) / 2));
    const top = Math.max(0, Math.floor((height - cropHeight) / 2));

    const cropped = await sharpFactory(imageBuffer)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .jpeg({ quality: 92 })
      .toBuffer();

    return {
      ok: true,
      buffer: cropped,
      width: cropWidth,
      height: cropHeight,
      technique: "smart_center_crop",
    };
  } catch (caught) {
    return {
      ok: false,
      reason: `crop_failed: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }
}
