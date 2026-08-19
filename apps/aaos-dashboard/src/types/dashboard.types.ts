/**
 * Client-safe DTO shapes returned by this app's own `src/app/api/*` proxy routes — deliberately
 * NOT imported from `apps/aaos-api`'s internal `dto/*.ts` files (a different app) or any `@aos/*`
 * package. Kept as plain, hand-written interfaces so nothing here can ever accidentally pull a
 * Node-only runtime value into a `"use client"` bundle (AAOS-W4A coordinator note #2).
 */

export interface AdMetricsDto {
  readonly spend: number;
  readonly clicks: number;
  /** AAOS-TAMARA-PAGES redesign (coordinator note #3): mirrors `AdMetricsResponseDto.frequency` on the real `aaos-api` response — plumbed through so "Audit Biaya"'s "Audiens jenuh (frequency >= 3.5)" waste-detection section can work off real per-ad data, same pattern as `clicks`. */
  readonly frequency: number;
  readonly conversations: number;
  readonly d2: number;
  readonly d3: number;
  readonly d5: number;
  readonly leadForm: number;
  readonly totalLead: number;
  readonly rphD3: number | null;
  /** AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE: mirrors `AdMetricsResponseDto.rphLead` on the real `aaos-api` response (`spend / totalLead`, division-by-zero safe — see `Rph`/`AdMetrics` in `@aos/meta-ads-connector`). Was already computed server-side but never plumbed through this app's DTOs; added so "Lead & Spend per Cabang × Source"'s "RP/LEAD" column can reuse the real per-ad value rather than re-deriving it, same discipline as `rphD3`. */
  readonly rphLead: number | null;
}

export interface CampaignAdDto {
  readonly id: string;
  readonly stableId: string;
  readonly name: string;
  readonly campaignName: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly verdict: string;
  readonly metrics: AdMetricsDto;
  /** AAOS-TAMARA-PAGES redesign: mirrors `AdResponseDto.daysSinceCreation` on the real `aaos-api` response — powers "Audit Biaya"'s "Iklan Baru (last 14 days)" section. Optional (unlike `frequency`) rather than a required field on every existing fixture/caller: this app's other, already-shipped pages have no use for it, so widening every `CampaignAdDto`/`AdSummaryDto` literal across the codebase for one new section's sake isn't warranted — callers that need it check for `undefined`. */
  readonly daysSinceCreation?: number;
}

/** One ad within `AdSetSummaryDto.ads` — the `#C` level of the campaign→ad-set→ad hierarchy (spec "meta-ads/page.tsx" MAAO2 redesign). Distinct from `CampaignAdDto` only in that it omits `campaignName` (redundant once nested under its own campaign). */
export interface AdSummaryDto {
  readonly id: string;
  readonly stableId: string;
  readonly name: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly verdict: string;
  readonly metrics: AdMetricsDto;
  /** See `CampaignAdDto.daysSinceCreation` — same field, same optionality rationale. */
  readonly daysSinceCreation?: number;
}

/** The `#B` level. `stableId`/`spend` come straight from `aaos-api`'s real, already spend-sorted assignment (`@aos/meta-ads-connector`'s `StableIdAssigner`) — never recomputed client-side. */
export interface AdSetSummaryDto {
  readonly id: string;
  readonly stableId: string;
  readonly name: string;
  readonly status: string;
  readonly spend: number;
  readonly ads: readonly AdSummaryDto[];
}

/** The `#A` level. Same authoritative-`stableId`-from-backend contract as `AdSetSummaryDto`. */
export interface CampaignSummaryDto {
  readonly id: string;
  readonly stableId: string;
  readonly name: string;
  readonly objective: string;
  readonly status: string;
  readonly spend: number;
  readonly adSets: readonly AdSetSummaryDto[];
}

export interface AdAccountSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly syncedAt: string;
  /** Full campaign→ad-set→ad hierarchy — powers the MAAO2-style tree (`CampaignTree`). */
  readonly campaigns: readonly CampaignSummaryDto[];
  /** The same ads, flattened — kept for `CampaignDetailClient` (`/meta-ads/[campaignId]`), which looks up one ad by id and has no use for the tree structure. */
  readonly ads: readonly CampaignAdDto[];
  readonly totals: AdMetricsDto;
  readonly campaignCount: number;
  readonly adCount: number;
}

/** `GET /api/v1/meta-ads/accounts` proxy response entry (AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE coordinator note #6) — powers the multi-account pill selector on "Lead & Spend per Cabang × Source". */
export interface AdAccountOptionDto {
  readonly id: string;
  readonly name: string;
}

export interface ObjectiveDto {
  readonly id: string;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: readonly string[];
  readonly areaPriorities: readonly string[];
  readonly status: string;
  readonly createdAt: string;
}

export interface CopyVariantDto {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/**
 * AAOS-CREATIVE-REVIEW: `DRAFT` (saved, never sent to Kai — zero Kie AI spend) · `GENERATING`
 * (a human pressed "Kirim ke Kai"; the real pipeline is running) · `PENDING` (awaiting review) ·
 * `APPROVED`/`REJECTED` (reviewed) · `FAILED` (the real pipeline errored).
 */
export type CreativePackageStatusDto =
  "DRAFT" | "GENERATING" | "PENDING" | "APPROVED" | "REJECTED" | "FAILED";

/** `@aos/creative-agent`'s real `CreativeFormat` — a package-level decision, not a per-asset tag. */
export type CreativeFormatDto = "VIDEO_AND_IMAGES" | "IMAGES_ONLY";

export interface CreativePackageDto {
  readonly id: string;
  readonly briefId: string;
  readonly adId?: string;
  readonly stableId?: string;
  readonly branch: string;
  /** The scraped unit's `identityKey` — the key Kai matches source photos on. */
  readonly unit: string;
  readonly unitModel?: string;
  readonly title: string;
  readonly angle: string;
  readonly targetPersona: string;
  readonly reason: string;
  readonly requestedFormat: CreativeFormatDto;
  /** What Kai's real `FormatDecider` decided — may downgrade to `IMAGES_ONLY` with no source photos. */
  readonly decidedFormat?: CreativeFormatDto;
  readonly primaryMessage: string;
  readonly urgency: "HIGH" | "MEDIUM" | "LOW";
  readonly origin: "MANUAL" | "TAMARA";
  readonly status: CreativePackageStatusDto;
  /** Real asset-library photo URLs found for this unit when generation started. */
  readonly sourcePhotoUrls: readonly string[];
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly CopyVariantDto[];
  /** The real Kie AI model string, e.g. `veo3_fast+nano-banana-pro`. */
  readonly aiModel?: string;
  readonly confidenceScore?: number;
  readonly generationMs?: number;
  readonly selectedCopyVariantId?: string;
  readonly errorMessage?: string;
  readonly generatedAt?: string;
  readonly reviewedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One row of the real, append-only `creative_logs` audit trail. */
export interface CreativeLogDto {
  readonly id: string;
  readonly packageId?: string;
  readonly fromAgent: string;
  readonly toAgent?: string;
  readonly eventType: string;
  readonly message: string;
  readonly brief?: unknown;
  readonly result?: unknown;
  readonly error?: string;
  readonly metadata?: unknown;
  readonly adId?: string;
  readonly stableId?: string;
  readonly createdAt: string;
}

export interface CreativePackageDetailDto {
  readonly package: CreativePackageDto;
  readonly logs: readonly CreativeLogDto[];
}

export interface SalesHumanDto {
  readonly id: string;
  readonly name: string;
  readonly waNumber: string;
  readonly status: "ON" | "BUSY" | "OFF";
  readonly maxLeadsPerDay: number;
  readonly todayLeadCount: number;
  readonly isAvailable: boolean;
}

export interface BranchDto {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly wabaPhoneNumber: string;
  readonly assignmentMode: "SMART_ASSIGN" | "ROUND_ROBIN" | "MANUAL";
  readonly maxLeadsPerSalesPerDay: number;
  readonly active: boolean;
  readonly team: readonly SalesHumanDto[];
  readonly availableCount: number;
  readonly queueSize: number;
  readonly todayAssignedCount: number;
}

export interface LeadDto {
  readonly id: string;
  readonly leadPhone: string;
  readonly leadName?: string;
  readonly branchId: string;
  readonly status: string;
  readonly temperature: string;
  readonly score: number;
  readonly createdAt: string;
}

/**
 * Client-safe mirror of `aaos-api`'s `ClosingResponseDto` (`GET /api/v1/closings`, proxied via
 * this app's own `/api/closings` route) — one test-drive/SPK/cancellation record from the real
 * `closings` Supabase table (`@aos/lead-store`'s `Closing` entity). Powers the Overview page's
 * KPI strip (Test Drive/SPK/Komisi Total counts) and "Closing Terbaru" list.
 */
export interface ClosingDto {
  readonly id: string;
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly branchId: string;
  readonly closingType: "TEST_DRIVE" | "SPK" | "CANCELLED";
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly testDriveAt?: string;
  readonly spkAt?: string;
  readonly createdAt: string;
}

export interface ApiErrorBody {
  readonly error: { readonly code?: string; readonly message: string };
}

/**
 * `/api/llm/*` DTOs (AAOS-TAMARA-PAGES redesign) — client-safe mirrors of the `aaos-api` LLM
 * module's response shapes documented in `docs/PROMPT-AAOS-API-LLM-TAMARA.md` (built by a sibling
 * task; this app's `/api/llm/*` routes proxy to it). Kept as plain hand-written interfaces for the
 * same reason as every other DTO in this file — see this file's own top docstring.
 */
export interface LlmTemuanDto {
  readonly icon: string;
  readonly judul: string;
  readonly detail: string;
}

export interface LlmRekomendasiDto {
  readonly aksi: string;
  readonly target: string;
  readonly alasan: string;
  readonly estimasi: string;
}

export interface LlmAnalyzeResponseDto {
  readonly temuan: readonly LlmTemuanDto[];
  readonly rekomendasi: readonly LlmRekomendasiDto[];
  readonly ringkasan: string;
}

/** Client-safe mirror of `@aos/meta-ads-agent`'s `CreativeBrief` entity fields (coordinator note #4/#5) — plain strings, not the backend's `Branch`/`AdAngle` enums, matching this file's "never import a backend enum" convention. */
export interface LlmCreativeBriefResponseDto {
  readonly unit: string;
  readonly angle: string;
  readonly branch: string;
  readonly primaryMessage: string;
  readonly tone: string;
  readonly formats: readonly string[];
  readonly avoid: readonly string[];
  readonly urgency: string;
  readonly reason: string;
}

export interface LlmChatMessageDto {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface LlmChatResponseDto {
  readonly reply: string;
}

/**
 * AAOS-DASHBOARD-SIMULASI — client-safe mirrors of `aaos-api`'s new `modules/simulation` DTOs
 * (`GET/POST /api/v1/simulation/*`, proxied via this app's own `/api/simulation/*` routes). Same
 * "plain hand-written interface, never import a backend DTO" convention as this file's other
 * `Llm*Dto` types.
 */
export interface SimulationTamaraStageDto {
  readonly available: boolean;
  readonly reason?: string;
  readonly temuan?: readonly LlmTemuanDto[];
  readonly rekomendasi?: readonly LlmRekomendasiDto[];
  readonly ringkasan?: string;
  readonly elapsedMs: number;
  readonly coverageScore: number;
  readonly audienceTargeting?: SimulationAudienceTargetingDto;
}

/**
 * One REAL Meta interest Tamara selected (AAOS-SIMULASI-TARGETING). Every value here — including
 * both audience-size bounds — is Meta's own, originally fetched by a live
 * `GET /search?type=adinterest` call and stored in `meta_interests`. The dashboard never computes,
 * rounds, or estimates an audience size.
 */
export interface SimulationSelectedInterestDto {
  readonly id: string;
  readonly name: string;
  readonly audienceSizeLower: number;
  readonly audienceSizeUpper: number;
  readonly topic?: string;
}

/**
 * The display-only "Campaign yang Akan Dibuat (Preview)" audience block. Mirrors aaos-api's
 * `AudienceTargetingPreview`.
 *
 * `geo`/`radiusKm`/`ageMin`/`ageMax` are an UNREVIEWED initial default derived from the branch's
 * real physical location — `geoNote` carries the Indonesian caveat and MUST be rendered alongside
 * them. `interests` are real Meta interests. Nothing in this block is ever sent to Meta: real
 * campaign creation (`/meta-ads/strategi`) constructs no targeting at all and is untouched by
 * this feature.
 */
export interface SimulationAudienceTargetingDto {
  readonly branch: string;
  readonly geo: readonly string[];
  readonly radiusKm: number;
  readonly ageMin: number;
  readonly ageMax: number;
  readonly geoNote: string;
  readonly candidateCount: number;
  readonly interests: readonly SimulationSelectedInterestDto[];
  readonly reasoning?: string;
  readonly interestsUnavailableReason?: string;
}

export interface SimulationKaiBriefDto {
  readonly unit: string;
  readonly angle: string;
  readonly branch: string;
  readonly primaryMessage: string;
  readonly tone: string;
  readonly formats: readonly string[];
  readonly avoid: readonly string[];
  readonly urgency: string;
}

export interface SimulationKaiStageDto {
  readonly available: boolean;
  readonly reason?: string;
  readonly brief?: SimulationKaiBriefDto;
  readonly elapsedMs: number;
  readonly videoGenerated: false;
  readonly note: string;
}

export interface SimulationJessyPersonaRunDto {
  readonly personaId: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly finalScore?: number;
  readonly finalTemperature?: string;
  readonly handoffTriggered?: boolean;
  readonly totalTurns?: number;
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly feedbackItems?: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

export interface SimulationJessyStageDto {
  readonly available: boolean;
  readonly reason?: string;
  readonly runs: readonly SimulationJessyPersonaRunDto[];
  readonly elapsedMs: number;
}

export interface SimulationScoringDto {
  readonly tamaraCoverageScore: number;
  readonly kaiScore: number;
  readonly jessyScore: number;
  readonly overallScore: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly verdict: "GO" | "CONDITIONAL" | "NO-GO" | "INCOMPLETE";
}

export interface SimulationResultDto {
  readonly tamara: SimulationTamaraStageDto;
  readonly kai: SimulationKaiStageDto;
  readonly jessy: SimulationJessyStageDto;
  readonly scoring: SimulationScoringDto;
}

export interface SimulationLogEntryDto {
  readonly step: string;
  readonly level: string;
  readonly message: string;
  /**
   * Real structured data attached to a log line (`simulation_logs.payload`). Only the audience-
   * targeting step writes it today — every other line omits it, so the log panel's "Lihat data"
   * toggle appears only where there is genuinely something to show.
   */
  readonly payload?: Record<string, unknown>;
  readonly createdAt: string;
}

export interface SimulationStatusDto {
  readonly id: string;
  readonly status: "RUNNING" | "DONE" | "ERROR";
  readonly currentStep: string;
  readonly campaignDataSource: "cache" | "fresh";
  readonly personaIds: readonly string[];
  readonly branch?: string;
  readonly result?: SimulationResultDto;
  readonly errorMessage?: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
  readonly decidedAt?: string;
  readonly logs: readonly SimulationLogEntryDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SimulationHistoryEntryDto {
  readonly id: string;
  readonly status: "RUNNING" | "DONE" | "ERROR";
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Client-safe mirror of `apps/aaos-simulator`'s `POST /api/simulate` response (proxied via this
 * app's own `/api/simulator-run` route) — used by Step 4's standalone "coba satu persona" preview,
 * independent of the full orchestrated `/api/simulation/*` pipeline. Prefixed `Jessy*` (not
 * `Simulation*`) to avoid clashing with the `Simulation*Dto` family above, which describes THIS
 * app's own `aaos-api`-backed pipeline record, not `aaos-simulator`'s raw response.
 */
export interface JessySimulationRunDto {
  readonly finalScore: number;
  readonly finalTemperature: string;
  readonly handoffTriggered: boolean;
  readonly totalTurns: number;
  readonly overallScore: number;
  readonly grade: string;
  readonly verdict: string;
  readonly feedbackItems: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

/**
 * AAOS-SCRAPER-ASSET-LIBRARY — client-safe mirrors of the new `aaos-api` `/api/v1/scraper/*` and
 * `/api/v1/assets/*` response DTOs, reached exclusively through this app's own server-only
 * `/api/scraper/*` / `/api/assets/*` proxy routes (a `"use client"` component must NEVER call
 * `aaos-api` directly — see `src/lib/api.ts`'s module doc).
 *
 * Deliberately NO `width`/`height`/`durationSeconds`/`isMainPhoto`/`usedInPackages`/`source` fields:
 * nothing in the backend produces any of them, so the UI omits them rather than rendering a
 * fabricated value.
 */
export type AssetTypeDto =
  "UNIT_PHOTO" | "BRAND" | "TESTIMONIAL" | "AI_VIDEO" | "AI_IMAGE" | "OVERLAY";

/** The real `AssetStatus` union — there is no `REJECTED` state anywhere in this domain. */
export type AssetStatusDto = "ACTIVE" | "ARCHIVED" | "PENDING";

export interface AssetDto {
  readonly id: string;
  readonly type: AssetTypeDto;
  readonly status: AssetStatusDto;
  readonly storagePath: string;
  readonly publicUrl: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly tags: readonly string[];
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitYear?: number;
  readonly branch?: string;
  readonly aiPrompt?: string;
  readonly aiModel?: string;
  readonly creativeBriefId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssetListDto {
  readonly assets: readonly AssetDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface AssetStatsDto {
  readonly totalAssets: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly byBranch: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly totalSizeBytes: number;
}

export interface AssetDownloadDto {
  readonly url: string;
  readonly expiresInSeconds: number;
}

export interface ScrapedUnitDto {
  readonly unitId: string;
  readonly url: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly transmission: "AT" | "MT";
  readonly color: string;
  readonly kilometer: number;
  readonly priceIdr: number;
  readonly branch: string;
  /** SOURCE listing photo URLs. The GCS-stored copies are assets — fetched via `/api/assets?unitId=`. */
  readonly photos: readonly string[];
  readonly photoCount: number;
  readonly available: boolean;
  readonly scrapedAt: string;
}

export interface StockListDto {
  readonly units: readonly ScrapedUnitDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface ScrapeJobResultDto {
  readonly unitsScraped: number;
  readonly newUnits: number;
  readonly soldUnits: number;
  readonly photosStored: number;
  readonly photosFailed: number;
  readonly unitsPersisted?: number;
  readonly unitId?: string;
}

export interface ScrapeJobLogEntryDto {
  readonly level: "INFO" | "WARN" | "ERROR";
  readonly message: string;
  readonly createdAt: string;
}

export interface ScrapeJobDto {
  readonly id: string;
  readonly kind: "FULL" | "UNIT";
  readonly status: "RUNNING" | "DONE" | "ERROR";
  readonly unitUrl?: string;
  readonly branch?: string;
  readonly progressCurrent: number;
  /** Absent until the listing has really been parsed — the progress bar stays indeterminate until then. */
  readonly progressTotal?: number;
  readonly result?: ScrapeJobResultDto;
  readonly errorMessage?: string;
  readonly logs: readonly ScrapeJobLogEntryDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ScraperStatusDto {
  readonly totalUnits: number;
  readonly availableUnits: number;
  readonly totalPhotos: number;
  readonly byBranch: Readonly<Record<string, number>>;
  /** Absent when nothing has ever been scraped — never a fabricated timestamp. */
  readonly lastScrapedAt?: string;
  readonly lastJob?: ScrapeJobDto;
}

export interface RunScrapeResponseDto {
  readonly jobId: string;
  readonly status: "RUNNING";
  readonly kind: "FULL" | "UNIT";
}

/**
 * `/api/calendar*` DTOs (AAOS-KALENDER-AKTIVITAS) — client-safe mirror of `aaos-api`'s
 * `CalendarEventResponseDto`. `eventType` is deliberately `string`, not a literal union: only the
 * 5 supported types are ever offered by "Tambah Jadwal" (see `CALENDAR_EVENT_TYPE_OPTIONS` in
 * `components/calendar/calendar.types.ts`), but a row this app merely displays should not fail to
 * typecheck if the backend ever adds a 6th.
 */
export interface CalendarEventResultDto {
  readonly summary: string;
  readonly [key: string]: unknown;
}

export interface CalendarEventDto {
  readonly id: string;
  readonly eventType: string;
  readonly title: string;
  readonly description?: string;
  readonly scheduledAt: string;
  readonly timezone: string;
  readonly recurrence: string;
  readonly recurrenceDays?: readonly number[];
  readonly recurrenceTime?: string;
  readonly status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly targetId?: string;
  readonly targetName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly result?: CalendarEventResultDto;
  readonly errorMessage?: string;
  readonly createdBy: string;
  readonly createdAt: string;
}
