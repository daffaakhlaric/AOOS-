import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaOrganicClient } from "../../contracts/IMetaOrganicClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaGraphApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaOrganicApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./Tracer.js";

export interface PublishFacebookPostInput {
  readonly pageId: string;
  readonly message: string;
  readonly link?: string;
  /** A valid Page access token — this use case takes it as an explicit param, NOT read from any storage. No OAuth flow exists yet to populate a token source safely (Phase 2 of AAOS-SOSMED-AUTOMATION; see coordinator note point 2). */
  readonly accessToken: string;
}

export interface PublishFacebookPostOutput {
  /** Meta's real `POST /{page-id}/feed` response id, formatted `"<page-id>_<post-id>"`. */
  readonly postId: string;
}

/**
 * AAOS-SOSMED-AUTOMATION Phase 2: `POST /{page-id}/feed` — publishes a text (+ optional link)
 * post to a Facebook Page. Built following `@aos/meta-ads-connector`'s `CreateCustomAudience.ts`
 * contract-first, `Result<T,E>`, rate-limited/retried/traced shape. Endpoint verified 2026-08-22
 * against Meta's Pages API "Posts" guide.
 */
export class PublishFacebookPost {
  constructor(
    private readonly client: IMetaOrganicClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: PublishFacebookPostInput,
  ): Promise<Result<PublishFacebookPostOutput, MetaGraphApiError>> {
    return this.tracer.startActiveSpan(
      "meta-organic-connector.publish-facebook-post",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaOrganicApi(this.rateLimiter, this.retry, () =>
            this.client.publishFacebookPost(
              { pageId: input.pageId, message: input.message, link: input.link },
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { pageId: input.pageId, error: result.error.message },
              "meta-organic-connector: Facebook post publish failed",
            );
            return err(result.error);
          }
          this.logger.info(
            { pageId: input.pageId, postId: result.value.id },
            "meta-organic-connector: Facebook post published",
          );
          return ok({ postId: result.value.id });
        } finally {
          span.end();
        }
      },
    );
  }
}
