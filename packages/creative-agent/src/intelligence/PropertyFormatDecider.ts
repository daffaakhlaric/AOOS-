import { AspectRatio, ImageModel, resolveVideoModel } from "@aos/creative-connector";

import type { IPropertyFormatDecider } from "../contracts/IPropertyFormatDecider.js";
import type { PropertyCreativeBrief } from "../contracts/IPropertyPromptBuilder.js";
import { CreativeFormat } from "../domain/value-objects/CreativeFormat.js";
import { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import { PropertyAdAngle } from "../domain/value-objects/PropertyAdAngle.js";
import { VideoSpec } from "../domain/value-objects/VideoSpec.js";

const DEFAULT_IMAGE_COUNT = 3;
const WALKTHROUGH_SECONDS = 30;
const SHORT_CLIP_SECONDS = 15;
const IMAGES_ONLY_FALLBACK_SECONDS = 8;

/**
 * Whether `angle` is inherently video-worthy — the PROPERTY-vertical stand-in for
 * `FormatDecider.decideFormat`'s `brief.formats.some(video)` check (`PropertyCreativeBrief` has
 * no `formats` field to ask, so the angle itself carries that signal): `VIRTUAL_TOUR` is
 * definitionally a walkthrough video, `TESTIMONIAL`/`EXCLUSIVE` read as premium/authentic when
 * shot as video, `PROMO_TERBATAS`'s urgency is best conveyed with motion. The remaining 4 angles
 * (`DP_RINGAN`/`READY_HUNI`/`INVESTASI`/`SYARIAH`) are informational/rational appeals that read
 * fine as a photo carousel. Exhaustive over all 8 `PropertyAdAngle` members.
 */
const ANGLE_VIDEO_APPROPRIATE: Readonly<Record<PropertyAdAngle, boolean>> = {
  [PropertyAdAngle.DP_RINGAN]: false,
  [PropertyAdAngle.READY_HUNI]: false,
  [PropertyAdAngle.INVESTASI]: false,
  [PropertyAdAngle.EXCLUSIVE]: true,
  [PropertyAdAngle.SYARIAH]: false,
  [PropertyAdAngle.PROMO_TERBATAS]: true,
  [PropertyAdAngle.TESTIMONIAL]: true,
  [PropertyAdAngle.VIRTUAL_TOUR]: true,
};

/**
 * The PROPERTY-vertical stand-in for `FormatDecider.decideVideoSpec`'s `brief.urgency` read
 * (`PropertyCreativeBrief` has no `urgency` field — `angle` drives the same HIGH/MEDIUM/LOW
 * urgency-equivalent decision `decideVideoSpec`'s model choice needs). `PROMO_TERBATAS` (a
 * time-limited offer) and `VIRTUAL_TOUR` (a flagship, highest-fidelity asset) get the higher-
 * quality `VEO3` model; every other angle uses the faster/cheaper `VEO3_FAST`, same tiering
 * `FormatDecider` applies for non-`HIGH` urgency. Exhaustive over all 8 `PropertyAdAngle` members.
 */
const ANGLE_URGENCY: Readonly<Record<PropertyAdAngle, "HIGH" | "MEDIUM" | "LOW">> = {
  [PropertyAdAngle.DP_RINGAN]: "MEDIUM",
  [PropertyAdAngle.READY_HUNI]: "MEDIUM",
  [PropertyAdAngle.INVESTASI]: "MEDIUM",
  [PropertyAdAngle.EXCLUSIVE]: "MEDIUM",
  [PropertyAdAngle.SYARIAH]: "LOW",
  [PropertyAdAngle.PROMO_TERBATAS]: "HIGH",
  [PropertyAdAngle.TESTIMONIAL]: "MEDIUM",
  [PropertyAdAngle.VIRTUAL_TOUR]: "HIGH",
};

/**
 * Decides `CreativeFormat` + the concrete `VideoSpec`/`ImageSpec` for a `PropertyCreativeBrief` —
 * the PROPERTY sibling to `FormatDecider`, reading `PropertyCreativeBrief`'s own fields
 * (`angle` standing in for `formats`/`urgency`'s role — see `ANGLE_VIDEO_APPROPRIATE`/
 * `ANGLE_URGENCY`'s docstrings) instead of `CreativeBrief`'s. Fully deterministic — no
 * randomness, no LLM calls, same brief + photo count always yields the same decision.
 */
export class PropertyFormatDecider implements IPropertyFormatDecider {
  decideFormat(brief: PropertyCreativeBrief, availablePhotos: number): CreativeFormat {
    const videoAppropriate = ANGLE_VIDEO_APPROPRIATE[brief.angle];
    if (videoAppropriate && availablePhotos >= 1) {
      return CreativeFormat.VIDEO_AND_IMAGES;
    }
    return CreativeFormat.IMAGES_ONLY;
  }

  decideVideoSpec(brief: PropertyCreativeBrief): VideoSpec {
    const videoAppropriate = ANGLE_VIDEO_APPROPRIATE[brief.angle];
    const durationSeconds =
      brief.angle === PropertyAdAngle.VIRTUAL_TOUR
        ? WALKTHROUGH_SECONDS
        : videoAppropriate
          ? SHORT_CLIP_SECONDS
          : IMAGES_ONLY_FALLBACK_SECONDS;
    const model = resolveVideoModel(ANGLE_URGENCY[brief.angle]);
    // A virtual tour reads best as a vertical, mobile-scroll walkthrough (same "story-shaped"
    // reasoning `FormatDecider` applies for `IMAGE_STORY`); every other angle stays widescreen,
    // the real feed default.
    const aspectRatio =
      brief.angle === PropertyAdAngle.VIRTUAL_TOUR ? AspectRatio.VERTICAL : AspectRatio.WIDESCREEN;

    const result = VideoSpec.create({ durationSeconds, aspectRatio, model });
    /* v8 ignore next 3 -- unreachable: `durationSeconds` above is always one of 8/15/30 (all positive), so `VideoSpec.create`'s only failure mode can never trigger here. */
    if (!result.ok) {
      throw new Error(
        `PropertyFormatDecider: unreachable VideoSpec validation failure: ${result.error.message}`,
      );
    }
    return result.value;
  }

  decideImageSpec(brief: PropertyCreativeBrief): ImageSpec {
    const aspectRatio =
      brief.angle === PropertyAdAngle.VIRTUAL_TOUR ? AspectRatio.VERTICAL : AspectRatio.SQUARE;

    const result = ImageSpec.create({
      count: DEFAULT_IMAGE_COUNT,
      aspectRatio,
      model: ImageModel.NANO_BANANA_PRO,
    });
    /* v8 ignore next 3 -- unreachable: `DEFAULT_IMAGE_COUNT` is a positive integer literal, so `ImageSpec.create`'s only failure mode can never trigger here. */
    if (!result.ok) {
      throw new Error(
        `PropertyFormatDecider: unreachable ImageSpec validation failure: ${result.error.message}`,
      );
    }
    return result.value;
  }
}
