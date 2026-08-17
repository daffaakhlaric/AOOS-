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

export interface CreativePackageDto {
  readonly id: string;
  readonly briefId: string;
  readonly branch: string;
  readonly unit: string;
  readonly title: string;
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly CopyVariantDto[];
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly selectedCopyVariantId?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
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
