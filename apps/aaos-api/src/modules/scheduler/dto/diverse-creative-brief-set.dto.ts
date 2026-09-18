import { z } from "zod";

import type { CreativePackageResponseDto } from "../../creative-packages/dto/creative-package-response.dto.js";
import {
  MAX_DIVERSE_BRIEF_COUNT,
  SamanthaCreativeContextSchema,
} from "../../llm/dto/diverse-creative-brief-set.dto.js";

/**
 * `POST /api/v1/creative-packages/diverse-set` (Samantha Andromeda-Aware Campaign System, Sprint 2)
 * — the real endpoint the frontend's "Brief Kai sekarang" button (`AndromedaHealthCard`) calls when
 * a campaign's diversity is `LOW_DIVERSITY`/`NOT_ENOUGH_DATA`. `listingId` is required (a real,
 * tenant-scoped `listings.id` — `creative_packages` is fundamentally listing-scoped, not
 * campaign-scoped, see `SchedulerService.createDiverseCreativeBriefSet`'s own doc). `campaignId` is
 * optional real context (Meta campaign id) threaded only into the created rows' `reason`/
 * `relatedVerdictId` for traceability — never used to look anything up.
 */
export const DiverseCreativeBriefSetBodySchema = z.object({
  listingId: z.string().min(1),
  campaignId: z.string().optional(),
  requestedCount: z.number().int().min(1).max(MAX_DIVERSE_BRIEF_COUNT).default(5),
  /**
   * EYVRA — SAMANTHA V2 + KAI V2 Phase 23. Optional, real `CampaignDiagnosis`/`SamanthaDecision`
   * context from `GET /api/campaign-health/:campaignId` — threaded straight into
   * `LlmService.generateDiverseCreativeBriefSet`'s own request DTO (see that schema's own doc for
   * the full "why", mirroring EYVRA — SAMANTHA V2 Phase 11's identical `samanthaDiagnosis` pattern
   * on `campaignInsight`). `undefined` for `AndromedaHealthCard`'s own diversity-status trigger
   * (no `CampaignDiagnosis` exists there) or a pre-Phase-23 client — never required.
   */
  samanthaContext: SamanthaCreativeContextSchema.optional(),
});
export type DiverseCreativeBriefSetBodyDto = z.infer<typeof DiverseCreativeBriefSetBodySchema>;

export interface DiverseCreativeBriefSetResultDto {
  readonly requestedCount: number;
  /** How many real briefs the daily `max_auto_briefs_per_day` guardrail remainder honestly allowed this call to generate — always `<= requestedCount`. */
  readonly allowedCount: number;
  /** `true` when `requestedCount > allowedCount` — the real daily cap, not a fabricated one, capped this specific call. */
  readonly cappedByDailyLimit: boolean;
  /** Real count of `creative_packages` rows actually created (`<= allowedCount` — an LLM/fallback may honestly produce fewer than `allowedCount` distinct still-unused angles). */
  readonly createdCount: number;
  readonly packages: readonly CreativePackageResponseDto[];
  /** Human-readable, honest reason when `createdCount === 0` (e.g. daily cap already reached, or every real `PropertyAdAngle` already in use) — `undefined` when at least 1 package was created. */
  readonly skippedReason?: string;
}
