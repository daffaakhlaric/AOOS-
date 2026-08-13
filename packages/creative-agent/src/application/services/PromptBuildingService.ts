import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { IPromptBuilder } from "../../contracts/IPromptBuilder.js";

const IMAGE_VARIANT_COUNT = 3;

export interface BuiltPrompts {
  readonly videoPrompt?: string;
  readonly imagePrompts: ReadonlyArray<string>;
}

/** Application-layer wrapper (spec "application/services/PromptBuildingService.ts") over `IPromptBuilder` — builds the video prompt (when needed) plus all `IMAGE_VARIANT_COUNT` image prompts in one call. */
export class PromptBuildingService {
  constructor(private readonly promptBuilder: IPromptBuilder) {}

  build(brief: CreativeBrief, needsVideo: boolean, sourcePhotoAvailable: boolean): BuiltPrompts {
    const videoPrompt = needsVideo
      ? this.promptBuilder.buildVideoPrompt(brief, sourcePhotoAvailable)
      : undefined;

    const imagePrompts = Array.from({ length: IMAGE_VARIANT_COUNT }, (_, index) =>
      this.promptBuilder.buildImagePrompt(brief, index),
    );

    return { videoPrompt, imagePrompts };
  }
}
