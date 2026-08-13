import { err, ok, type Result } from "@aos/common";

import type {
  ICreativeOrchestrator,
  OrchestrateGenerationInput,
  OrchestrateGenerationOutput,
} from "../../contracts/ICreativeOrchestrator.js";
import type { IImageSetGenerator } from "../../contracts/IImageSetGenerator.js";
import type { IMediaDownloader } from "../../contracts/IMediaDownloader.js";
import type {
  ISourceImageUploader,
  SupportedImageMimeType,
} from "../../contracts/ISourceImageUploader.js";
import type { IVideoGenerator } from "../../contracts/IVideoGenerator.js";
import { GenerationError } from "../../domain/errors/GenerationError.js";

/** Injectable fetch used ONLY to pull a source photo's bytes back from its `@aos/asset-library` (Supabase) public URL — Kai's own responsibility per the spec pipeline ("UploadSourceImage → fileUrl"), distinct from `@aos/creative-connector`'s `DownloadMedia` (which downloads Kie AI's own generated-media CDN links). */
export type FetchSourcePhoto = (url: string) => Promise<Response>;

/**
 * Calls `@aos/creative-connector` for real (spec "Full Pipeline: ProcessCreativeBrief" steps
 * 4-6). Implements the graceful-degradation rules from the spec's "Error handling" section:
 *
 *  - Source photo fetch/upload failure -> continue WITHOUT a source photo (falls back to
 *    text-to-image/video generation, per COORDINATOR NOTE #7 — `GenerateImage`'s `sourceImageUrl`
 *    is optional).
 *  - Video generation (or its media download) failure -> continue WITHOUT a video; the package
 *    still reaches `READY`, just images-only.
 *  - 1-of-N image failures -> continue with the images that succeeded.
 *  - ALL image generations (or downloads) fail -> the ONLY case this service returns `err`.
 */
export class CreativeOrchestratorService implements ICreativeOrchestrator {
  constructor(
    private readonly uploadSourceImage: ISourceImageUploader,
    private readonly generateLongVideo: IVideoGenerator,
    private readonly generateImageSet: IImageSetGenerator,
    private readonly downloadMedia: IMediaDownloader,
    private readonly fetchSourcePhoto: FetchSourcePhoto = (url) => fetch(url),
  ) {}

  async orchestrate(
    input: OrchestrateGenerationInput,
  ): Promise<Result<OrchestrateGenerationOutput, GenerationError>> {
    const sourceFileUrl = await this.tryUploadSourcePhoto(input);

    const { videoBuffer, videoDelivered } = await this.tryGenerateVideo(input, sourceFileUrl);

    const imageBuffers = await this.generateImages(input, sourceFileUrl);
    if (imageBuffers.length === 0) {
      return err(
        new GenerationError(
          `CreativeOrchestratorService: all ${input.imagePrompts.length} image generation(s) failed`,
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

  private async tryUploadSourcePhoto(
    input: OrchestrateGenerationInput,
  ): Promise<string | undefined> {
    if (input.sourcePhotoUrl === undefined) {
      return undefined;
    }

    let response: Response;
    try {
      response = await this.fetchSourcePhoto(input.sourcePhotoUrl);
    } catch {
      return undefined;
    }
    if (!response.ok) {
      return undefined;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await response.arrayBuffer());
    } catch {
      return undefined;
    }

    const mimeType = mapMimeType(input.sourcePhotoMimeType);
    const uploadResult = await this.uploadSourceImage.execute(
      buffer,
      input.sourcePhotoFileName ?? "source-photo.jpg",
      mimeType,
      undefined,
      input.correlationId,
    );
    if (!uploadResult.ok) {
      return undefined;
    }
    return uploadResult.value.fileUrl.toString();
  }

  private async tryGenerateVideo(
    input: OrchestrateGenerationInput,
    sourceFileUrl: string | undefined,
  ): Promise<{ videoBuffer?: Buffer; videoDelivered: boolean }> {
    if (input.videoPrompt === undefined || input.videoSpec === undefined) {
      return { videoDelivered: false };
    }

    const videoResult = await this.generateLongVideo.execute({
      sourceImageUrl: sourceFileUrl,
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
    sourceFileUrl: string | undefined,
  ): Promise<ReadonlyArray<Buffer>> {
    const setResult = await this.generateImageSet.execute({
      requests: input.imagePrompts.map((prompt) => ({
        sourceImageUrl: sourceFileUrl,
        prompt,
        aspectRatio: input.imageSpec.aspectRatio,
      })),
    });
    /* v8 ignore next 3 -- unreachable: `GenerateImageSet.execute` always returns `ok` (its `Result` error type is `never` — per-request failures are collected into `.failed`, not thrown/returned). */
    if (!setResult.ok) {
      return [];
    }

    const sorted = [...setResult.value.succeeded].sort((a, b) => a.index - b.index);
    const buffers: Buffer[] = [];
    for (const success of sorted) {
      const downloadResult = await this.downloadMedia.execute(success.image.imageUrl);
      if (downloadResult.ok) {
        buffers.push(downloadResult.value);
      }
    }
    return buffers;
  }
}

function mapMimeType(raw: string | undefined): SupportedImageMimeType {
  if (raw === "image/png" || raw === "image/webp") {
    return raw;
  }
  return "image/jpeg";
}
