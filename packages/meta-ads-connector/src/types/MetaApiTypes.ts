import { z } from "zod";

/**
 * Raw Meta Graph API v21.0 response shapes plus their Zod validators. Every field Meta reports
 * as a metric is a numeric-looking *string* (Graph API convention), so schemas below intentionally
 * keep those as `z.string()` — parsing to `number` happens later in `mappers/`, past the
 * "validated with Zod before use" boundary these schemas exist to enforce.
 */

export const MetaActionSchema = z.object({
  action_type: z.string(),
  value: z.string(),
});
export type MetaAction = z.infer<typeof MetaActionSchema>;

/** One row of `insights.date_preset(last_30d){...}` — Meta always wraps insights in an edge with a `data` array, even though AAOS only ever requests a single aggregated row. */
export const MetaInsightRowSchema = z.object({
  spend: z.string().optional(),
  impressions: z.string().optional(),
  reach: z.string().optional(),
  frequency: z.string().optional(),
  clicks: z.string().optional(),
  actions: z.array(MetaActionSchema).optional(),
  /** Separate top-level metric Meta reports alongside `actions[]`; used as a fallback source for D1/conversations — see `utils/D3Calculator.ts`. */
  messaging_conversation_started: z.string().optional(),
});
export type MetaInsightRow = z.infer<typeof MetaInsightRowSchema>;

export const MetaInsightsEdgeSchema = z.object({
  data: z.array(MetaInsightRowSchema),
});
export type MetaInsightsEdge = z.infer<typeof MetaInsightsEdgeSchema>;

export const MetaPagingSchema = z.object({
  cursors: z
    .object({
      before: z.string().optional(),
      after: z.string().optional(),
    })
    .optional(),
  next: z.string().optional(),
  previous: z.string().optional(),
});
export type MetaPaging = z.infer<typeof MetaPagingSchema>;

/**
 * `created_time` is not in the spec's literal campaign field-selector list, but is included here
 * (and requested by `MetaApiRequestBuilder`) because the AAOS `Campaign` domain entity requires a
 * `createdAt: Date` — a deliberate, documented deviation (see README "Deviations from spec").
 */
export const MetaCampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  created_time: z.string().optional(),
  insights: MetaInsightsEdgeSchema.optional(),
});
export type MetaCampaign = z.infer<typeof MetaCampaignSchema>;

export const MetaCampaignListResponseSchema = z.object({
  data: z.array(MetaCampaignSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaCampaignListResponse = z.infer<typeof MetaCampaignListResponseSchema>;

export const MetaAdSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  /** Meta budget fields are IDR *cents* — see `utils/CurrencyUtils.ts` for the conversion to whole Rupiah. */
  daily_budget: z.string().optional(),
  insights: MetaInsightsEdgeSchema.optional(),
});
export type MetaAdSet = z.infer<typeof MetaAdSetSchema>;

export const MetaAdSetListResponseSchema = z.object({
  data: z.array(MetaAdSetSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdSetListResponse = z.infer<typeof MetaAdSetListResponseSchema>;

export const MetaAdSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  created_time: z.string(),
  insights: MetaInsightsEdgeSchema.optional(),
});
export type MetaAd = z.infer<typeof MetaAdSchema>;

export const MetaAdListResponseSchema = z.object({
  data: z.array(MetaAdSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdListResponse = z.infer<typeof MetaAdListResponseSchema>;

/** Response of `POST /{ad-id}`, `POST /{adset-id}`, `POST /{campaign-id}` action calls. Meta returns `{ success: true }` for status/field updates. */
export const MetaUpdateResponseSchema = z
  .object({
    success: z.boolean().optional(),
    id: z.string().optional(),
  })
  .refine((v) => v.success !== undefined || v.id !== undefined, {
    message: "Meta update response must contain at least one of `success` or `id`",
  });
export type MetaUpdateResponse = z.infer<typeof MetaUpdateResponseSchema>;

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
