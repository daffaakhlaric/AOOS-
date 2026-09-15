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
 *  - Source photo fetch/upload failure -> continue WITHOUT that source photo (falls back to
 *    text-to-image/video generation if none succeed, per COORDINATOR NOTE #7 —
 *    `GenerateImage`'s `sourceImageUrls` is optional).
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
    const { fileUrls: sourceFileUrls, skippedReason: sourcePhotoSkippedReason } =
      await this.tryUploadSourcePhotos(input);

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
      //
      // REAL BUG FIX #2 (live-confirmed against api.kie.ai): `sourcePhotoSkippedReason` was
      // computed above (`tryUploadSourcePhotos`'s own real per-photo failure reasons) but never
      // actually reached this message — a manager saw "all 3 image generation(s) failed — HTTP
      // 404" with no way to know the REAL upstream cause was that every source photo failed to
      // upload to Kie AI's file host, so every `generateImage` call silently fell back to
      // text-to-image (no `image_urls` in the real outgoing request at all, confirmed directly in
      // Kie AI's own dashboard) instead of the intended image-to-image generation. Prepended first
      // — it is the more likely ROOT cause when present, `imageFailures` are its downstream symptom.
      const reasonParts = [
        ...(sourcePhotoSkippedReason !== undefined
          ? [`source photo upload: ${sourcePhotoSkippedReason}`]
          : []),
        ...imageFailures.slice(0, 3),
      ];
      const reasons =
        reasonParts.length > 0
          ? ` — ${reasonParts.join("; ")}${
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
      ...(sourcePhotoSkippedReason !== undefined ? { sourcePhotoSkippedReason } : {}),
    });
  }

  /**
   * REAL BUG FIX: every failure branch here used to silently discard its reason and just fall
   * back to no-source-photo generation — a real scraped photo could be found AND genuinely
   * publicly fetchable, and still silently never reach Kie AI, with no trace anywhere of why
   * (found live: a package with a real, curl-verified-200 `assets` photo URL still generated
   * TEXT_2_VIDEO). Every branch below now names exactly which step failed.
   *
   * Uploads up to `input.sourcePhotoUrls.length` real photos (Kie AI's real, confirmed-live limit
   * is 2 reference images — `KaiAgentService` never sends more) to Kie AI's own file host,
   * independently per photo — one photo failing never blocks the others (same
   * partial-failure-tolerant discipline as `generateImages` below).
   */
  private async tryUploadSourcePhotos(
    input: OrchestrateGenerationInput,
  ): Promise<{ readonly fileUrls: readonly string[]; readonly skippedReason?: string }> {
    const sourceUrls = input.sourcePhotoUrls ?? [];
    if (sourceUrls.length === 0) {
      return { fileUrls: [] };
    }

    const fileUrls: string[] = [];
    const failures: string[] = [];

    for (const [index, sourceUrl] of sourceUrls.entries()) {
      const label = `source photo ${String(index + 1)}`;
      const fileName =
        input.sourcePhotoFileNames?.[index] ?? `source-photo-${String(index + 1)}.jpg`;
      const mimeType = mapMimeType(input.sourcePhotoMimeTypes?.[index]);

      let response: Response;
      try {
        response = await this.fetchSourcePhoto(sourceUrl);
      } catch (error) {
        failures.push(`failed to fetch ${label}: ${toErrorMessage(error)}`);
        continue;
      }
      if (!response.ok) {
        failures.push(`${label} fetch responded with HTTP ${String(response.status)}`);
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        failures.push(`failed to read ${label} response body: ${toErrorMessage(error)}`);
        continue;
      }

      const uploadResult = await this.uploadSourceImage.execute(
        buffer,
        fileName,
        mimeType,
        undefined,
        input.correlationId,
      );
      if (!uploadResult.ok) {
        failures.push(`Kie AI file upload failed for ${label}: ${uploadResult.error.message}`);
        continue;
      }
      fileUrls.push(uploadResult.value.fileUrl.toString());
    }

    return {
      fileUrls,
      ...(failures.length > 0 ? { skippedReason: failures.join("; ") } : {}),
    };
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapMimeType(raw: string | undefined): SupportedImageMimeType {
  if (raw === "image/png" || raw === "image/webp") {
    return raw;
  }
  return "image/jpeg";
}
