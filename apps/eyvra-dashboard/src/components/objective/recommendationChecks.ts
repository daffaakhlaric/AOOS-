import {
  isBusinessContextFilled,
  type PropertyObjectiveDto,
} from "@/types/property-objective.types";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

/**
 * SAMANTHA ADVANCED SPRINT 3 — "Rekomendasi Perbaikan" checklist on the Objective settings page
 * (real user feedback: "objective settingannya juga keliatan apa yang harus di perbaiki").
 *
 * REAL, DETERMINISTIC LOGIC — NOT an LLM call. Every check below is a plain comparison over real,
 * already-loaded numbers/booleans (the objective row's own business-context/automation columns, the
 * real listing-picker data `PropertyObjectiveForm.tsx` already fetches, and the real per-ad
 * `rphLead` values `/api/campaigns` already returns). Mirrors `SamanthaInsightBar.tsx`'s own exact
 * precedent/reasoning ("a real, zero-cost DETERMINISTIC summary, not an LLM call for every page
 * load") — routing a simple `a > b` / `array.length === 0` check through an LLM would be slower,
 * costlier, and carries a real (if small) risk of a fabricated sentence for what is genuinely just
 * arithmetic — never justified here.
 *
 * Kept as a separate, framework-free module (no React import) so each check's true/false/threshold
 * condition is independently unit-testable without rendering anything — same "pure function file
 * next to its component" split `campaignInsightMath.ts` already establishes for
 * `SamanthaInsightBar`/`CampaignInsightPanel`.
 */

export type RecommendationSeverity = "warning" | "info";

export interface RecommendationItem {
  readonly key: string;
  readonly severity: RecommendationSeverity;
  readonly text: string;
}

export interface RecommendationInput {
  /** The tenant's real, current-period objective row (`undefined` = none set yet this period — handled as a separate, encouraging empty state by the component, never as "0 issues found"). */
  readonly existingObjective: PropertyObjectiveDto | undefined;
  /** Real count of `status=AKTIF` listings — the SAME real `GET /api/listings?status=AKTIF` fetch `PropertyObjectiveForm.tsx` already performs for its own checkbox picker (`undefined` while still loading — the check honestly waits rather than assuming 0). */
  readonly activeListingsCount: number | undefined;
  /** Real, already-loaded campaign data from `/api/campaigns` (`undefined` while loading/unavailable — every campaign-derived check below honestly no-ops rather than assuming a fabricated 0). */
  readonly campaigns: readonly CampaignSummaryDto[] | undefined;
}

/**
 * Portfolio-average CPL across every real, currently-loaded ad with a computable `rphLead` —
 * deliberately the SAME real formula `CampaignTable.tsx`'s own `computePortfolioAvgCplIDR` and
 * `PropertyObjectiveService.getBudgetSuggestion` (aaos-api) already compute, re-derived here (not
 * imported — `CampaignTable.tsx`'s version is a private, unexported module function) rather than
 * inventing a different average. Returns `undefined` (never a fabricated `0`) when there is no real
 * computable sample yet — the honest "no data" outcome this whole session's "never fabricate a
 * recommendation from empty data" discipline requires.
 */
export function computePortfolioAvgCplIDR(
  campaigns: readonly CampaignSummaryDto[],
): number | undefined {
  const values = campaigns
    .flatMap((campaign) => campaign.adSets.flatMap((adSet) => adSet.ads))
    .map((ad) => ad.metrics.rphLead)
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** A real, honest "has this tenant actually been running campaigns" signal — at least 1 campaign with real spend, not just an empty ad account shell. */
function hasRealCampaignActivity(campaigns: readonly CampaignSummaryDto[]): boolean {
  return campaigns.some((campaign) => campaign.spend > 0);
}

/**
 * Judgment-call threshold (documented, not hidden): a real objective row older than 2 weeks is
 * treated as "this loop has been running for a while" for the auto-loop/auto-publish review nudge
 * below. No sharper real signal exists in this codebase today (`property_objectives` is the only
 * per-tenant automation-settings home, and it is period-scoped — see `047_creative_packages_auto_
 * loop.sql`'s own header doc for that honestly-documented caveat) — `createdAt` is a real, already
 * -persisted timestamp, not a fabricated one, so this is an honest (if imperfect) proxy rather than
 * an invented one.
 */
const AUTO_LOOP_REVIEW_THRESHOLD_DAYS = 14;

function formatIDR(value: number): string {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

/**
 * Builds the real, honest "Rekomendasi Perbaikan" checklist for a tenant that HAS a current-period
 * objective. Callers must handle `existingObjective === undefined` themselves as a distinct,
 * encouraging empty state (see this file's own header doc) — this function assumes an objective
 * exists so every text string below can safely reference its real fields.
 */
export function buildRecommendations(input: RecommendationInput): readonly RecommendationItem[] {
  const { existingObjective } = input;
  if (existingObjective === undefined) {
    return [];
  }

  const items: RecommendationItem[] = [];

  // Check 1 — business context completeness. Reuses the REAL, already-existing
  // `isBusinessContextFilled` predicate (both `aaos-api` and this dashboard already define/use it
  // identically) rather than re-deriving the "0/empty counts as not filled" rule a second time.
  if (!isBusinessContextFilled(existingObjective)) {
    items.push({
      key: "business-context-missing",
      severity: "warning",
      text: "Konteks bisnis (rata-rata nilai closing, target & batas biaya per HOT lead) belum lengkap diisi — lengkapi di card “Konteks Bisnis” di bawah supaya reasoning Verdict Samantha akurat.",
    });
  }

  // Check 2 — is the tenant's own `breakevenCpl` realistic given what campaigns are ACTUALLY
  // spending right now? Only fires when both a real `breakevenCpl > 0` AND a real, computable
  // portfolio-average CPL exist — a tenant with 0 campaigns or all-null `rphLead` never gets this
  // item (see `computePortfolioAvgCplIDR`'s own "never a fabricated 0" doc).
  const portfolioAvgCplIDR =
    input.campaigns !== undefined ? computePortfolioAvgCplIDR(input.campaigns) : undefined;
  if (
    existingObjective.breakevenCpl !== undefined &&
    existingObjective.breakevenCpl > 0 &&
    portfolioAvgCplIDR !== undefined &&
    portfolioAvgCplIDR > existingObjective.breakevenCpl
  ) {
    items.push({
      key: "breakeven-cpl-too-low",
      severity: "warning",
      text: `Rata-rata biaya per lead campaign kamu saat ini (${formatIDR(portfolioAvgCplIDR)}) sudah di atas batas maksimal CPL yang kamu set (${formatIDR(existingObjective.breakevenCpl)}) — pertimbangkan naikkan batasnya kalau memang masih profitable, atau evaluasi campaign yang boros.`,
    });
  }

  // Check 3 — real "Fokus Listing" coverage gap. Only fires once the real active-listing count has
  // actually loaded (`undefined` = still loading, honestly skipped, never assumed 0) AND there is
  // at least 1 real active listing to choose from.
  if (
    input.activeListingsCount !== undefined &&
    input.activeListingsCount > 0 &&
    existingObjective.focusListings.length === 0
  ) {
    items.push({
      key: "focus-listing-empty",
      severity: "warning",
      text: `Kamu punya ${String(input.activeListingsCount)} listing aktif tapi belum satupun dipilih sebagai Fokus Listing — pilih minimal 1 di bawah supaya Samantha tahu listing mana yang diprioritaskan.`,
    });
  }

  // Check 4 — a real, neutral "you may want to review this" nudge for automation settings left at
  // their real DB defaults (never a push to blindly turn automation on). Only fires when there is
  // real campaign activity (spend > 0 — not just an empty ad account) AND the objective row itself
  // is old enough that "still at the default" is a genuine signal, not just "you set this 10
  // minutes ago".
  const createdAtMs = Date.parse(existingObjective.createdAt);
  const daysSinceCreated = Number.isFinite(createdAtMs)
    ? (Date.now() - createdAtMs) / (24 * 60 * 60 * 1000)
    : undefined;
  if (
    input.campaigns !== undefined &&
    hasRealCampaignActivity(input.campaigns) &&
    daysSinceCreated !== undefined &&
    daysSinceCreated >= AUTO_LOOP_REVIEW_THRESHOLD_DAYS &&
    existingObjective.autoApproveCreativeBrief === false &&
    existingObjective.autoPublishCampaign === false
  ) {
    items.push({
      key: "auto-loop-defaults-review",
      severity: "info",
      text: "Pengaturan automasi (auto-approve brief kreatif di Automasi Campaign) masih nonaktif sejak objective ini dibuat lebih dari 2 minggu lalu — tinjau lagi apakah kamu mau mengaktifkannya untuk mempercepat loop Samantha, atau tetap manual. Ini cuma pengingat, bukan rekomendasi untuk otomatis mengaktifkan.",
    });
  }

  return items;
}
