import { z } from "zod";

/**
 * Raw Meta Graph API response shapes (Pages/Instagram content publishing surface) plus their Zod
 * validators. Endpoint shapes verified 2026-08-22 against Meta's real developer docs (Pages API
 * "Posts" guide, Instagram Platform "Content Publishing" guide, and the Graph API/Instagram
 * Platform "Insights" references) — see docstrings below for what was verified where.
 */

/**
 * Response of `POST /{page-id}/feed` — verified 2026-08-22 against Meta's Pages API "Posts" guide:
 * on success the Graph API returns just `{ id: "<page-id>_<post-id>" }`.
 */
export const FeedPostResponseSchema = z.object({
  id: z.string(),
});
export type FeedPostResponse = z.infer<typeof FeedPostResponseSchema>;

/**
 * Response of `POST /{ig-user-id}/media` (media container creation) — verified 2026-08-22 against
 * Meta's Instagram Platform "Content Publishing" guide: on success the Graph API returns just
 * `{ id: "<IG_CONTAINER_ID>" }`. This id is the `creation_id` fed into `media_publish`.
 */
export const MediaContainerResponseSchema = z.object({
  id: z.string(),
});
export type MediaContainerResponse = z.infer<typeof MediaContainerResponseSchema>;

/**
 * Response of `POST /{ig-user-id}/media_publish` — verified 2026-08-22 against Meta's Instagram
 * Platform "Content Publishing" guide: on success the Graph API returns `{ id: "<IG_MEDIA_ID>" }`,
 * the real, now-published media's id (distinct from the container id passed in as `creation_id`).
 */
export const MediaPublishResponseSchema = z.object({
  id: z.string(),
});
export type MediaPublishResponse = z.infer<typeof MediaPublishResponseSchema>;

/** One row of an Insights `values[]` array — `end_time` is absent for `period: "lifetime"` metrics (the only period this package requests). */
export const MetaInsightValueSchema = z.object({
  value: z.union([z.number(), z.record(z.string(), z.number())]),
  end_time: z.string().optional(),
});
export type MetaInsightValue = z.infer<typeof MetaInsightValueSchema>;

/** One named metric inside an Insights response's `data[]` array. */
export const MetaInsightMetricSchema = z.object({
  name: z.string(),
  period: z.string(),
  values: z.array(MetaInsightValueSchema),
  title: z.string().optional(),
  description: z.string().optional(),
  id: z.string().optional(),
});
export type MetaInsightMetric = z.infer<typeof MetaInsightMetricSchema>;

/**
 * Response of `GET /{post-id}/insights` (Facebook Page post) and `GET /{ig-media-id}/insights`
 * (Instagram media) — both endpoints share this `{ data: [...] }` envelope shape (verified
 * 2026-08-22 against Meta's Graph API Insights reference and the Instagram Platform Insights
 * guide), even though the two surfaces report different metric *names* (see
 * `MetaGraphApiRequestBuilder`'s `PAGE_POST_INSIGHTS_METRICS`/`IG_MEDIA_INSIGHTS_METRICS`
 * docstrings for exactly which).
 */
export const MetaInsightsResponseSchema = z.object({
  data: z.array(MetaInsightMetricSchema),
});
export type MetaInsightsResponse = z.infer<typeof MetaInsightsResponseSchema>;

/** Meta's standard Graph API error envelope, shared across every endpoint this package calls. */
export const MetaErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});
export type MetaErrorResponse = z.infer<typeof MetaErrorResponseSchema>;
