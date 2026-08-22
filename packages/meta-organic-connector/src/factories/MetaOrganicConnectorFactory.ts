import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { GetInstagramMediaInsights } from "../application/use-cases/GetInstagramMediaInsights.js";
import { GetPagePostInsights } from "../application/use-cases/GetPagePostInsights.js";
import { PublishFacebookPost } from "../application/use-cases/PublishFacebookPost.js";
import { PublishInstagramMedia } from "../application/use-cases/PublishInstagramMedia.js";
import type { Tracer } from "../application/use-cases/Tracer.js";
import type { IMetaOrganicClient } from "../contracts/IMetaOrganicClient.js";
import { MetaGraphApiClient } from "../infrastructure/meta-api/MetaGraphApiClient.js";
import { TokenBucketRateLimiter } from "../infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../infrastructure/retry/ExponentialBackoffRetry.js";

export interface MetaOrganicConnectorFactoryOptions {
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable `fetch`, forwarded to `MetaGraphApiClient` — primarily for tests. */
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly rateLimitPerHour?: number;
  readonly retryMaxAttempts?: number;
  readonly retryBaseDelayMs?: number;
}

export interface MetaOrganicConnector {
  readonly publishFacebookPost: PublishFacebookPost;
  readonly publishInstagramMedia: PublishInstagramMedia;
  readonly getPagePostInsights: GetPagePostInsights;
  readonly getInstagramMediaInsights: GetInstagramMediaInsights;
  readonly rateLimiter: TokenBucketRateLimiter;
  /** The raw `IMetaOrganicClient` port — exposed like `@aos/meta-ads-connector`'s equivalent `client`, in case a caller needs a one-off lightweight call without a dedicated use-case class. */
  readonly client: IMetaOrganicClient;
}

/**
 * The composition root (Factory Pattern) for this package — mirrors
 * `@aos/meta-ads-connector`'s `MetaAdsConnectorFactory` shape, but is a genuinely separate
 * composition root (coordinator note point 1 on `docs/PROMPT-AAOS-SOSMED-AUTOMATION.md`): no
 * config object is required here (unlike `MetaAdsConnectorFactory`, which needs a real ad-account
 * config) because this package has no per-ad-account scoping — every use case takes its Page/IG
 * user id and access token as explicit call-time params instead.
 */
export class MetaOrganicConnectorFactory {
  static create(options: MetaOrganicConnectorFactoryOptions = {}): MetaOrganicConnector {
    const logger = options.logger ?? createLogger({ serviceName: "meta-organic-connector" });
    const tracer: Tracer = options.tracer ?? getTracer("meta-organic-connector");

    const client = new MetaGraphApiClient({
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const rateLimiter = new TokenBucketRateLimiter({ capacity: options.rateLimitPerHour });
    const retry = new ExponentialBackoffRetry({
      maxAttempts: options.retryMaxAttempts,
      baseDelayMs: options.retryBaseDelayMs,
    });

    const publishFacebookPost = new PublishFacebookPost(client, rateLimiter, retry, logger, tracer);
    const publishInstagramMedia = new PublishInstagramMedia(
      client,
      rateLimiter,
      retry,
      logger,
      tracer,
    );
    const getPagePostInsights = new GetPagePostInsights(client, rateLimiter, retry, logger, tracer);
    const getInstagramMediaInsights = new GetInstagramMediaInsights(
      client,
      rateLimiter,
      retry,
      logger,
      tracer,
    );

    return {
      publishFacebookPost,
      publishInstagramMedia,
      getPagePostInsights,
      getInstagramMediaInsights,
      rateLimiter,
      client,
    };
  }
}
