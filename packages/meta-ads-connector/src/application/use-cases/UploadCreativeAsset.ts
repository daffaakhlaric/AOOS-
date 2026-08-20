import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import { ApiServerError, type MetaApiError } from "../../domain/errors/index.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export type CreativeAssetType = "VIDEO" | "IMAGE";

export interface UploadCreativeAssetInput {
  readonly adAccountId: AdAccountId;
  readonly assetType: CreativeAssetType;
  /** A real, already-hosted (GCS) video/image URL — the Simulasi wizard's already-generated creative package output, per point 1 of the Go Live spec. Meta pulls the bytes from this URL server-side; AAOS never uploads raw bytes itself. */
  readonly hostedUrl: string;
  readonly accessToken: string;
}

export interface UploadCreativeAssetOutput {
  readonly assetType: CreativeAssetType;
  /** Meta's real video id (for `video_data.video_id`) or image hash (for `link_data.image_hash`) — the identifier `CreateAd` needs. */
  readonly assetId: string;
}

/**
 * AAOS-GO-LIVE: uploads a real creative asset into the ad account's asset library, returning a
 * Meta-usable id/hash for `CreateAd`. A single combined use case (not separate
 * `UploadVideoAsset`/`UploadImageAsset` classes) because both branches are a one-call POST with
 * only the request URL/body shape and response-field extraction differing — Meta's real video
 * (`POST /{ad-account}/advideos`, returns `{ id }`) and image (`POST /{ad-account}/adimages`,
 * returns `{ images: { <key>: { hash, url } } }`) upload endpoints genuinely differ in response
 * shape, which is why `IMetaAdsClient` still exposes them as two distinct methods
 * (`uploadVideo`/`uploadImage`) — this use case is the thin, asset-type-branching orchestration
 * layer over both.
 */
export class UploadCreativeAsset {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: UploadCreativeAssetInput,
  ): Promise<Result<UploadCreativeAssetOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.upload-creative-asset",
      async (span: { end: () => void }) => {
        try {
          if (input.assetType === "VIDEO") {
            return await this.uploadVideo(input);
          }
          return await this.uploadImage(input);
        } finally {
          span.end();
        }
      },
    );
  }

  private async uploadVideo(
    input: UploadCreativeAssetInput,
  ): Promise<Result<UploadCreativeAssetOutput, MetaApiError>> {
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.uploadVideo(input.adAccountId.toString(), input.hostedUrl, input.accessToken),
    );
    if (!result.ok) {
      this.logger.warn(
        { adAccountId: input.adAccountId.toString(), error: result.error.message },
        "meta-ads-connector: video asset upload failed",
      );
      return err(result.error);
    }
    this.logger.info({ videoId: result.value.id }, "meta-ads-connector: video asset uploaded");
    return ok({ assetType: "VIDEO", assetId: result.value.id });
  }

  private async uploadImage(
    input: UploadCreativeAssetInput,
  ): Promise<Result<UploadCreativeAssetOutput, MetaApiError>> {
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.uploadImage(input.adAccountId.toString(), input.hostedUrl, input.accessToken),
    );
    if (!result.ok) {
      this.logger.warn(
        { adAccountId: input.adAccountId.toString(), error: result.error.message },
        "meta-ads-connector: image asset upload failed",
      );
      return err(result.error);
    }
    const firstKey = Object.keys(result.value.images)[0];
    if (firstKey === undefined) {
      const noImagesError = new ApiServerError(
        "Meta image upload response contained no images entries",
      );
      this.logger.warn(
        { adAccountId: input.adAccountId.toString() },
        "meta-ads-connector: image asset upload returned an empty images map",
      );
      return err(noImagesError);
    }
    const hash = result.value.images[firstKey]?.hash;
    if (hash === undefined) {
      const missingHashError = new ApiServerError(
        "Meta image upload response entry was missing a hash",
      );
      return err(missingHashError);
    }
    this.logger.info({ imageHash: hash }, "meta-ads-connector: image asset uploaded");
    return ok({ assetType: "IMAGE", assetId: hash });
  }
}
