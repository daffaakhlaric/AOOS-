import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaOrganicClient, InstagramMediaSpec } from "../../contracts/IMetaOrganicClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaGraphApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaOrganicApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./Tracer.js";

export interface PublishInstagramMediaInput {
  readonly igUserId: string;
  readonly media: InstagramMediaSpec;
  readonly caption?: string;
  /** A valid IG-scoped user access token — explicit param, NOT read from any storage (same rule as `PublishFacebookPost`; see coordinator note point 2). */
  readonly accessToken: string;
}

export interface PublishInstagramMediaOutput {
  /** The real, published IG media id (from `media_publish`'s response — distinct from the intermediate container id). */
  readonly mediaId: string;
}

/**
 * AAOS-SOSMED-AUTOMATION Phase 2: orchestrates Meta's real two-step Instagram publish flow —
 * `POST /{ig-user-id}/media` (create a container) followed by `POST /{ig-user-id}/media_publish`
 * (publish it). Both real Graph API calls (verified 2026-08-22 against Meta's Instagram Platform
 * "Content Publishing" guide) go through the same rate-limit/retry/trace path as every other call
 * in this package — each is its own `callMetaOrganicApi` invocation (2 local rate-limit tokens
 * consumed per successful publish), mirroring how Meta itself treats them as two separate API
 * calls, not one atomic operation.
 */
export class PublishInstagramMedia {
  constructor(
    private readonly client: IMetaOrganicClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: PublishInstagramMediaInput,
  ): Promise<Result<PublishInstagramMediaOutput, MetaGraphApiError>> {
    return this.tracer.startActiveSpan(
      "meta-organic-connector.publish-instagram-media",
      async (span: { end: () => void }) => {
        try {
          const containerResult = await callMetaOrganicApi(this.rateLimiter, this.retry, () =>
            this.client.createInstagramMediaContainer(
              { igUserId: input.igUserId, media: input.media, caption: input.caption },
              input.accessToken,
            ),
          );
          if (!containerResult.ok) {
            this.logger.warn(
              { igUserId: input.igUserId, error: containerResult.error.message },
              "meta-organic-connector: Instagram media container creation failed",
            );
            return err(containerResult.error);
          }

          const publishResult = await callMetaOrganicApi(this.rateLimiter, this.retry, () =>
            this.client.publishInstagramMedia(
              { igUserId: input.igUserId, creationId: containerResult.value.id },
              input.accessToken,
            ),
          );
          if (!publishResult.ok) {
            this.logger.warn(
              {
                igUserId: input.igUserId,
                creationId: containerResult.value.id,
                error: publishResult.error.message,
              },
              "meta-organic-connector: Instagram media publish failed",
            );
            return err(publishResult.error);
          }

          this.logger.info(
            { igUserId: input.igUserId, mediaId: publishResult.value.id },
            "meta-organic-connector: Instagram media published",
          );
          return ok({ mediaId: publishResult.value.id });
        } finally {
          span.end();
        }
      },
    );
  }
}
