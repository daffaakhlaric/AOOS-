import { err, ok, type Result } from "@aos/common";

import type {
  ICreativeOrchestrator,
  OrchestrateGenerationInput,
  OrchestrateGenerationOutput,
} from "../../contracts/ICreativeOrchestrator.js";
import type { IImageSetGenerator } from "../../contracts/IImageSetGenerator.js";
import type { IMediaDownloader } from "../../contracts/IMediaDownloader.js";
import type { IVideoGenerator } from "../../contracts/IVideoGenerator.js";
import { GenerationError } from "../../domain/errors/GenerationError.js";

/**
 * Calls `@aos/creative-connector` for real (spec "Full Pipeline: ProcessCreativeBrief" steps
 * 4-6). Implements the graceful-degradation rules from the spec's "Error handling" section:
 *
 *  - Video generation (or its media download) failure -> continue WITHOUT a video; the package
 *    still reaches `READY`, just images-only.
 *  - 1-of-N image failures -> continue with the images that succeeded.
 *  - ALL image generations (or downloads) fail -> the ONLY case this service returns `err`.
 *
 * REAL BUG FIX (live-confirmed, 2026-09-15): this used to re-upload every source photo to Kie
 * AI's own file host (`kieai.redpandaai.co/api/file-stream-upload`) first, then reference THAT
 * upload's returned URL when calling `generateImage`/`generateVideoFromImage` — per the original
 * design doc's own worked example. Two real, separate bugs compounded on that path (both now
 * fixed at their own root, see `KieApiResponseMapper`'s git history): the upload response schema
 * didn't match the real API at all, and even once that was fixed, Kie AI's real image/video
 * generation endpoints did not reliably recognize the freshly-uploaded file's own URL when used
 * as a reference straight away. `input.sourcePhotoUrls` (this codebase's own real, already-public
 * GCS listing/asset-library URLs — the exact same URLs already rendered directly in `<img src>`
 * tags across this app) are passed straight through instead — no re-upload hop, one fewer real
 * failure mode, and Kie AI's generation endpoints accept an arbitrary public image URL directly.
 */
export class CreativeOrchestratorService implements ICreativeOrchestrator {
  constructor(
    private readonly generateLongVideo: IVideoGenerator,
    private readonly generateImageSet: IImageSetGenerator,
    private readonly downloadMedia: IMediaDownloader,
  ) {}

  async orchestrate(
    input: OrchestrateGenerationInput,
  ): Promise<Result<OrchestrateGenerationOutput, GenerationError>> {
    const sourceFileUrls = input.sourcePhotoUrls ?? [];

    const { videoBuffer, videoDelivered } = await this.tryGenerateVideo(input, sourceFileUrls);

    const { buffers: imageBuffers, failures: imageFailures } = await this.generateImages(
      input,
      sourceFileUrls,
    );
    if (imageBuffers.length === 0) {
      // REAL BUG FIX: this used to report only a count ("all 3 image generation(s) failed"),
      // discarding the real per-request `GenerateImageError`/download-failure reasons that
      // `generateImages` already collected — leaving a manager (and whoever debugs it) with no way
      // to tell a Kie AI quota/auth error apart from a bad source-photo URL apart from a timeout.
      // Every real reason is preserved (capped so a large batch can't produce an unreadable
      // message), never fabricated when the underlying calls report nothing.
      const reasons =
        imageFailures.length > 0
          ? ` — ${imageFailures.slice(0, 3).join("; ")}${
              imageFailures.length > 3 ? ` (+${String(imageFailures.length - 3)} more)` : ""
            }`
          : "";
      return err(
        new GenerationError(
          `CreativeOrchestratorService: all ${String(input.imagePrompts.length)} image generation(s) failed${reasons}`,
        ),
      );
    }

    return ok({
      videoBuffer,
      imageBuffers,
      imageSpecs: imageBuffers.map(() => input.imageSpec),
      videoDelivered,
    });
  }

  private async tryGenerateVideo(
    input: OrchestrateGenerationInput,
    sourceFileUrls: readonly string[],
  ): Promise<{ videoBuffer?: Buffer; videoDelivered: boolean }> {
    if (input.videoPrompt === undefined || input.videoSpec === undefined) {
      return { videoDelivered: false };
    }

    const videoResult = await this.generateLongVideo.execute({
      sourceImageUrls: sourceFileUrls,
      prompt: input.videoPrompt,
      targetDurationSeconds: input.videoSpec.durationSeconds,
      aspectRatio: input.videoSpec.aspectRatio,
      model: input.videoSpec.model,
      correlationId: input.correlationId,
    });
    if (!videoResult.ok) {
      return { videoDelivered: false };
    }

    const downloadResult = await this.downloadMedia.execute(videoResult.value.videoUrl);
    if (!downloadResult.ok) {
      return { videoDelivered: false };
    }
    return { videoBuffer: downloadResult.value, videoDelivered: true };
  }

  private async generateImages(
    input: OrchestrateGenerationInput,
    sourceFileUrls: readonly string[],
  ): Promise<{
    readonly buffers: ReadonlyArray<Buffer>;
    readonly failures: ReadonlyArray<string>;
  }> {
    const setResult = await this.generateImageSet.execute({
      requests: input.imagePrompts.map((prompt) => ({
        sourceImageUrls: sourceFileUrls,
        prompt,
        aspectRatio: input.imageSpec.aspectRatio,
      })),
    });
    /* v8 ignore next 3 -- unreachable: `GenerateImageSet.execute` always returns `ok` (its `Result` error type is `never` — per-request failures are collected into `.failed`, not thrown/returned). */
    if (!setResult.ok) {
      return { buffers: [], failures: [] };
    }

    // Real per-request failure reasons — see the REAL BUG FIX note at this method's call site.
    const failures: string[] = setResult.value.failed.map((f) => f.error.message);

    const sorted = [...setResult.value.succeeded].sort((a, b) => a.index - b.index);
    const buffers: Buffer[] = [];
    for (const success of sorted) {
      const downloadResult = await this.downloadMedia.execute(success.image.imageUrl);
      if (downloadResult.ok) {
        buffers.push(downloadResult.value);
      } else {
        failures.push(`download failed: ${downloadResult.error.message}`);
      }
    }
    return { buffers, failures };
  }
}
