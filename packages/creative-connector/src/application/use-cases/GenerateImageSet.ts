import { ok, type Result } from "@aos/common";

import type { GeneratedImage } from "../../domain/entities/GeneratedImage.js";

import type { GenerateImage, GenerateImageError, GenerateImageInput } from "./GenerateImage.js";

export interface GenerateImageSetInput {
  readonly requests: readonly GenerateImageInput[];
}

export interface GenerateImageSetSuccess {
  readonly index: number;
  readonly image: GeneratedImage;
}

export interface GenerateImageSetFailure {
  readonly index: number;
  readonly error: GenerateImageError;
}

export interface GenerateImageSetResult {
  readonly succeeded: readonly GenerateImageSetSuccess[];
  readonly failed: readonly GenerateImageSetFailure[];
}

/**
 * Runs N `GenerateImage` calls concurrently (`Promise.all`), per the spec ("N images in
 * parallel"). Partial-failure-tolerant by design, mirroring `@aos/mobix-web-scraper`'s
 * `DownloadAndStorePhotos`: one request's failure is collected into `.failed` rather than thrown
 * or short-circuiting the rest of the batch — this is why `execute()` returns
 * `Result<GenerateImageSetResult, never>`, the use case itself never fails, only individual
 * requests do.
 */
export class GenerateImageSet {
  constructor(private readonly generateImage: GenerateImage) {}

  async execute(input: GenerateImageSetInput): Promise<Result<GenerateImageSetResult, never>> {
    const outcomes = await Promise.all(
      input.requests.map(async (request, index) => ({
        index,
        result: await this.generateImage.execute(request),
      })),
    );

    const succeeded: GenerateImageSetSuccess[] = [];
    const failed: GenerateImageSetFailure[] = [];
    for (const { index, result } of outcomes) {
      if (result.ok) {
        succeeded.push({ index, image: result.value });
      } else {
        failed.push({ index, error: result.error });
      }
    }

    return ok({ succeeded, failed });
  }
}
