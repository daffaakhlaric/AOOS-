import { AspectRatio, ImageModel, resolveVideoModel } from "@aos/creative-connector";
import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { IFormatDecider } from "../contracts/IFormatDecider.js";
import { CreativeFormat } from "../domain/value-objects/CreativeFormat.js";
import { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import { VideoSpec } from "../domain/value-objects/VideoSpec.js";

const DEFAULT_IMAGE_COUNT = 3;
const SINGLE_CLIP_SECONDS = 8;
const VIDEO_15S_SECONDS = 15;
const VIDEO_30S_SECONDS = 30;

/**
 * Decides `CreativeFormat` + the concrete `VideoSpec`/`ImageSpec` for a `CreativeBrief` (spec
 * "Format Decision Logic"). Fully deterministic — no randomness, no LLM calls, same brief +
 * photo count always yields the same decision (Strategy Pattern: this is the ONE decision
 * strategy `FormatDecisionService` delegates to).
 */
export class FormatDecider implements IFormatDecider {
  decideFormat(brief: CreativeBrief, availablePhotos: number): CreativeFormat {
    const hasVideoFormat = brief.formats.some(
      (format) => format === "VIDEO_15S" || format === "VIDEO_30S",
    );
    if (hasVideoFormat && availablePhotos >= 1 && brief.urgency !== "LOW") {
      return CreativeFormat.VIDEO_AND_IMAGES;
    }
    return CreativeFormat.IMAGES_ONLY;
  }

  decideVideoSpec(brief: CreativeBrief): VideoSpec {
    const durationSeconds = brief.formats.includes("VIDEO_30S")
      ? VIDEO_30S_SECONDS
      : brief.formats.includes("VIDEO_15S")
        ? VIDEO_15S_SECONDS
        : SINGLE_CLIP_SECONDS;
    const model = resolveVideoModel(brief.urgency);
    const aspectRatio = brief.formats.includes("IMAGE_STORY")
      ? AspectRatio.VERTICAL
      : AspectRatio.WIDESCREEN;

    const result = VideoSpec.create({ durationSeconds, aspectRatio, model });
    /* v8 ignore next 3 -- unreachable: `durationSeconds` above is always one of 8/15/30 (all positive), so `VideoSpec.create`'s only failure mode can never trigger here. */
    if (!result.ok) {
      throw new Error(
        `FormatDecider: unreachable VideoSpec validation failure: ${result.error.message}`,
      );
    }
    return result.value;
  }

  decideImageSpec(brief: CreativeBrief): ImageSpec {
    const aspectRatio = brief.formats.includes("IMAGE_STORY")
      ? AspectRatio.VERTICAL
      : AspectRatio.SQUARE;

    const result = ImageSpec.create({
      count: DEFAULT_IMAGE_COUNT,
      aspectRatio,
      model: ImageModel.NANO_BANANA_PRO,
    });
    /* v8 ignore next 3 -- unreachable: `DEFAULT_IMAGE_COUNT` is a positive integer literal, so `ImageSpec.create`'s only failure mode can never trigger here. */
    if (!result.ok) {
      throw new Error(
        `FormatDecider: unreachable ImageSpec validation failure: ${result.error.message}`,
      );
    }
    return result.value;
  }
}
