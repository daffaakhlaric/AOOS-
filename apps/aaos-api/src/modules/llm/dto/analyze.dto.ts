import { z } from "zod";

import type {
  AdMetricsResponseDto,
  AdResponseDto,
  AdSetResponseDto,
  CampaignResponseDto,
} from "../../meta-ads/dto/campaign-response.dto.js";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `POST /api/v1/llm/analyze` request body — coordinator note #6: reuses the REAL
 * `GET /api/v1/campaigns` response shape (`modules/meta-ads/dto/campaign-response.dto.ts`) for its
 * `campaigns` field, rather than inventing a bespoke summarized shape the dashboard would need a
 * second data-reshaping step to produce. The dashboard can forward its cached
 * `AdAccountResponseDto.campaigns` array to this endpoint unchanged.
 *
 * Each nested Zod schema below is a `satisfies z.ZodType<...>` mirror of the corresponding
 * `campaign-response.dto.ts` interface — kept as a separate Zod schema (rather than validating
 * against the TS interface directly, which Zod cannot do) but structurally checked at compile
 * time to stay in sync with it.
 */
const AdMetricsSchema = z.object({
  spend: z.number(),
  impressions: z.number(),
  reach: z.number(),
  frequency: z.number(),
  clicks: z.number(),
  conversations: z.number(),
  d2: z.number(),
  d3: z.number(),
  d5: z.number(),
  leadForm: z.number(),
  totalLead: z.number(),
  rphChat: z.number().nullable(),
  rphD3: z.number().nullable(),
  rphLead: z.number().nullable(),
}) satisfies z.ZodType<AdMetricsResponseDto>;

const AdSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  metaId: z.string(),
  name: z.string(),
  status: z.string(),
  funnel: z.string(),
  branch: z.string(),
  verdict: z.string(),
  metrics: AdMetricsSchema,
  createdAt: z.string(),
  daysSinceCreation: z.number(),
}) satisfies z.ZodType<AdResponseDto>;

const AdSetSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  metaId: z.string(),
  name: z.string(),
  status: z.string(),
  branch: z.string(),
  dailyBudget: z.number(),
  spend: z.number(),
  ads: z.array(AdSchema),
}) satisfies z.ZodType<AdSetResponseDto>;

const CampaignSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  metaId: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  funnel: z.string(),
  branch: z.string(),
  spend: z.number(),
  createdAt: z.string(),
  adSets: z.array(AdSetSchema),
}) satisfies z.ZodType<CampaignResponseDto>;

/**
 * `totals` has no real DTO anywhere in the codebase (only per-campaign/per-ad `spend`/`metrics`
 * exist) — kept as an open numeric bag rather than inventing named fields (e.g. `totalSpend`)
 * that would just be a guess at what the dashboard aggregates. Optional: the endpoint works from
 * `campaigns` alone.
 */
const TotalsSchema = z.record(z.string(), z.number()).optional();

export const AnalyzeRequestSchema = z.object({
  campaigns: z.array(CampaignSchema),
  totals: TotalsSchema,
});
export type AnalyzeRequestDto = z.infer<typeof AnalyzeRequestSchema>;

const TemuanSchema = z.object({
  icon: z.string().min(1),
  judul: z.string().min(1),
  detail: z.string().min(1),
});

const RekomendasiSchema = z.object({
  aksi: z.enum(["SCALE", "PAUSE", "FIX", "KEEP"]),
  target: z.string().min(1),
  alasan: z.string().min(1),
  estimasi: z.string().min(1),
});

/** The shape Tamara's `analyze` system prompt asks the model to return — validated with Zod before ever reaching a caller (coordinator note #5). */
export const AnalyzeLlmPayloadSchema = z.object({
  temuan: z.array(TemuanSchema),
  rekomendasi: z.array(RekomendasiSchema),
  ringkasan: z.string().min(1),
});
export type AnalyzeLlmPayload = z.infer<typeof AnalyzeLlmPayloadSchema>;

export type AnalyzeResponseDto =
  ({ readonly available: true } & AnalyzeLlmPayload) | LlmUnavailableResponseDto;
