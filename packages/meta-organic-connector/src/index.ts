// Factory
export { MetaOrganicConnectorFactory } from "./factories/MetaOrganicConnectorFactory.js";
export type {
  MetaOrganicConnector,
  MetaOrganicConnectorFactoryOptions,
} from "./factories/MetaOrganicConnectorFactory.js";

// Use Cases
export { PublishFacebookPost } from "./application/use-cases/PublishFacebookPost.js";
export type {
  PublishFacebookPostInput,
  PublishFacebookPostOutput,
} from "./application/use-cases/PublishFacebookPost.js";
export { PublishInstagramMedia } from "./application/use-cases/PublishInstagramMedia.js";
export type {
  PublishInstagramMediaInput,
  PublishInstagramMediaOutput,
} from "./application/use-cases/PublishInstagramMedia.js";
export { GetPagePostInsights } from "./application/use-cases/GetPagePostInsights.js";
export type { GetPagePostInsightsInput } from "./application/use-cases/GetPagePostInsights.js";
export { GetInstagramMediaInsights } from "./application/use-cases/GetInstagramMediaInsights.js";
export type { GetInstagramMediaInsightsInput } from "./application/use-cases/GetInstagramMediaInsights.js";
export type { Tracer } from "./application/use-cases/Tracer.js";

// Errors
export {
  MetaOrganicConnectorError,
  MetaGraphApiError,
  ApiServerError,
  RateLimitError,
  AuthError,
  PermissionError,
} from "./domain/errors/index.js";

// Contracts
export type {
  IMetaOrganicClient,
  PublishFacebookPostParams,
  CreateInstagramMediaContainerParams,
  PublishInstagramMediaParams,
  InstagramMediaSpec,
  InstagramImageMediaSpec,
  InstagramVideoMediaSpec,
} from "./contracts/IMetaOrganicClient.js";
export type { IRateLimiter, RateLimitStatus } from "./contracts/IRateLimiter.js";

// Infrastructure
export { MetaGraphApiClient } from "./infrastructure/meta-api/MetaGraphApiClient.js";
export {
  MetaGraphApiRequestBuilder,
  PAGE_POST_INSIGHTS_METRICS,
  IG_MEDIA_INSIGHTS_METRICS,
} from "./infrastructure/meta-api/MetaGraphApiRequestBuilder.js";
export { TokenBucketRateLimiter } from "./infrastructure/rate-limiter/TokenBucketRateLimiter.js";
export {
  ExponentialBackoffRetry,
  isRetryable,
} from "./infrastructure/retry/ExponentialBackoffRetry.js";

// Types
export type {
  FeedPostResponse,
  MediaContainerResponse,
  MediaPublishResponse,
  MetaInsightsResponse,
  MetaInsightMetric,
  MetaInsightValue,
  MetaErrorResponse,
} from "./types/MetaGraphApiTypes.js";
export {
  FeedPostResponseSchema,
  MediaContainerResponseSchema,
  MediaPublishResponseSchema,
  MetaInsightsResponseSchema,
  MetaInsightMetricSchema,
  MetaInsightValueSchema,
  MetaErrorResponseSchema,
} from "./types/MetaGraphApiTypes.js";
