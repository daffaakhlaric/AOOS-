import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `POST /api/v1/llm/analyze` request body.
 *
 * Real bug fix: this used to `satisfies z.ZodType<CampaignResponseDto>` — i.e. mirror
 * `aaos-api`'s OWN internal `GET /api/v1/campaigns` response shape (`metaId`, campaign-level
 * `funnel`/`branch`/`createdAt`, ad-set-level `metaId`/`branch`/`dailyBudget`, ad-level `metaId`/
 * `createdAt`, and `impressions`/`reach`/`rphChat` on every ad's metrics) — on the stated
 * assumption that "the dashboard can forward its cached `AdAccountResponseDto.campaigns` array to
 * this endpoint unchanged". That assumption was never actually true: `apps/aaos-dashboard`'s own
 * `GET /api/campaigns` route (`toSummary`/`toCampaignSummary`/`toAdSetSummary`/`toAdSummary`)
 * deliberately RESHAPES AND TRIMS the real backend response into its own client-safe
 * `CampaignSummaryDto`/`AdSetSummaryDto`/`AdSummaryDto`/`AdMetricsDto` (see
 * `apps/aaos-dashboard/src/types/dashboard.types.ts`) before it ever reaches the browser — none of
 * those internal-bookkeeping fields exist on what the dashboard actually has cached, so every
 * dashboard caller of this endpoint (this "Analisa dengan AI" call, and
 * `POST /api/v1/simulation/start`'s identical mirror in `modules/simulation/dto/
 * start-simulation.dto.ts`) was rejected by `ZodValidationPipe` the first time either was actually
 * exercised against real data. This schema now mirrors the REAL dashboard-sent shape instead (kept
 * as its own literal Zod schema, not imported from `apps/aaos-dashboard` — a different app/
 * package boundary — so no `satisfies z.ZodType<...>` compile-time check is available here; keep
 * this in sync with `dashboard.types.ts` by hand if that file's `CampaignSummaryDto` family ever
 * changes).
 */
const AdMetricsSchema = z.object({
  spend: z.number(),
  frequency: z.number(),
  clicks: z.number(),
  conversations: z.number(),
  d2: z.number(),
  d3: z.number(),
  d5: z.number(),
  leadForm: z.number(),
  totalLead: z.number(),
  rphD3: z.number().nullable(),
  rphLead: z.number().nullable(),
});

const AdSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  name: z.string(),
  status: z.string(),
  funnel: z.string(),
  branch: z.string(),
  verdict: z.string(),
  metrics: AdMetricsSchema,
  daysSinceCreation: z.number().optional(),
});

const AdSetSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  name: z.string(),
  status: z.string(),
  spend: z.number(),
  ads: z.array(AdSchema),
});

const CampaignSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  spend: z.number(),
  adSets: z.array(AdSetSchema),
});

/**
 * `totals` has no real DTO anywhere in the codebase (only per-campaign/per-ad `spend`/`metrics`
 * exist) — kept as an open numeric bag rather than inventing named fields (e.g. `totalSpend`)
 * that would just be a guess at what the dashboard aggregates. Optional: the endpoint works from
 * `campaigns` alone.
 *
 * Real bug fix: `AdMetricsDto.rphD3`/`rphLead` (the real, dashboard-computed totals fields) are
 * `number | null` — division-by-zero-safe ratios that are genuinely `null` whenever `totalLead`/
 * `d3` is `0`. A plain `z.number()` value rejected every real payload where either total was zero.
 */
const TotalsSchema = z.record(z.string(), z.number().nullable()).optional();

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

/** The shape Samantha's `analyze` system prompt asks the model to return — validated with Zod before ever reaching a caller (coordinator note #5). */
export const AnalyzeLlmPayloadSchema = z.object({
  temuan: z.array(TemuanSchema),
  rekomendasi: z.array(RekomendasiSchema),
  ringkasan: z.string().min(1),
});
export type AnalyzeLlmPayload = z.infer<typeof AnalyzeLlmPayloadSchema>;

export type AnalyzeResponseDto =
  ({ readonly available: true } & AnalyzeLlmPayload) | LlmUnavailableResponseDto;
