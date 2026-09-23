import type { HealthStatus } from "../../campaign-health/domain/campaign-health.js";
import type { PropertyType } from "../../listings/dto/listing.dto.js";

/**
 * EYVRA — SAMANTHA V2 Phase 33 (PROMPT 34 — Historical Strategy Memory). Pure, deterministic
 * query/aggregation layer over data this codebase ALREADY persists — no new "learning" system, no
 * invented scoring.
 *
 * RAW SPEC PROSE (verbatim, confirmed from the original transcript):
 * ```
 * PROMPT 34 — HISTORICAL STRATEGY MEMORY
 *
 * Before campaign creation query:
 * same property type
 * same price segment
 * same area
 * same objective
 * historical winners
 * qualified lead performance
 * creative winning patterns
 *
 * Reuse principles.
 * Do NOT blindly clone.
 * ```
 *
 * HONEST AUDIT CONCLUSION (Phase 33's own): `samantha_campaign_assessments`
 * (`056_samantha_campaign_assessments.sql`, Phase 6) ALREADY durably stores real, per-campaign
 * `CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision` snapshots over time — that IS this
 * codebase's real historical outcome signal. What was genuinely MISSING is the join surface: that
 * table has no idea which LISTING (propertyType/price/area) or which GROWTH OBJECTIVE (metric) a
 * given `meta_campaign_id` belongs to. `campaign_creation_requests`
 * (`058_campaign_creation_requests.sql`, Phase 26) already carries exactly that link
 * (`listing_id` + `growth_objective_id` + the real `meta_campaign_id` Meta assigned). This file is
 * the pure aggregation half of the query/aggregation layer that JOINS those three ALREADY-REAL
 * tables (via `CampaignCreationService.getStrategyMemory`, which does the real I/O) — it invents no
 * new storage, no new "AI memory" table.
 *
 * WHAT THIS HONESTLY CANNOT DO (stated explicitly, never silently glossed over):
 *  - "qualified lead performance" — `CampaignHealth.leadQuality` is ALWAYS `UNKNOWN` in this
 *    codebase (see `campaign-health.ts`'s own header doc — no CPQL/CRM-stage data exists anywhere).
 *    This file does NOT fabricate a lead-quality signal; `costEfficiency.score` (real CPL-vs-
 *    benchmark) is the closest REAL proxy this codebase has for "did this strategy perform well",
 *    and is reported as exactly that, never relabelled as "lead quality".
 *  - "creative winning patterns" — no creative-outcome data source exists yet in this schema
 *    (the raw spec's own `PROMPT 62 — Creative Memory` is a separate, not-yet-built phase). Not
 *    attempted here.
 *  - "Reuse principles. Do NOT blindly clone." — this file returns an aggregate SUMMARY (status
 *    distribution, average cost-efficiency), never a single "best" past campaign to copy verbatim —
 *    consistent with the spec's own explicit anti-cloning instruction.
 *
 * MATCHING RULE ("same property type / same price segment / same area / same objective"): all four
 * must match exactly for a historical candidate to count — see `matchesTarget` below. A candidate
 * whose area can't honestly be compared (neither candidate nor target has a real `city`/`province`)
 * is never force-matched.
 *
 * HONEST DEGRADE: below `MIN_HISTORICAL_SAMPLE_SIZE` real matched candidates, this returns
 * `{available: false, reason}` — never a statistically meaningless average from 1-2 data points.
 * Same "not enough data yet is a real, first-class case" discipline `data-sufficiency.ts`/
 * `CampaignHealthService.compareLatest` already establish for this codebase.
 */

export type PriceSegment = "UNDER_500JT" | "500JT_TO_1M" | "1M_TO_2M" | "2M_TO_5M" | "OVER_5M";

/**
 * Fixed, documented IDR bands — a real real-estate market segmentation choice, not a fabricated
 * statistical derivation (this codebase has no per-tenant price-distribution data to calibrate
 * quantile boundaries from). Same "a fixed, named, honestly-documented threshold beats a fabricated
 * precise one" discipline `campaign-health.ts`'s `COST_EFFICIENCY_*` thresholds already establish.
 */
export const PRICE_SEGMENT_BOUNDARIES_IDR = {
  UNDER_500JT: 500_000_000,
  UPPER_1M: 1_000_000_000,
  UPPER_2M: 2_000_000_000,
  UPPER_5M: 5_000_000_000,
} as const;

export function resolvePriceSegment(priceIdr: number): PriceSegment {
  if (priceIdr < PRICE_SEGMENT_BOUNDARIES_IDR.UNDER_500JT) {
    return "UNDER_500JT";
  }
  if (priceIdr < PRICE_SEGMENT_BOUNDARIES_IDR.UPPER_1M) {
    return "500JT_TO_1M";
  }
  if (priceIdr < PRICE_SEGMENT_BOUNDARIES_IDR.UPPER_2M) {
    return "1M_TO_2M";
  }
  if (priceIdr < PRICE_SEGMENT_BOUNDARIES_IDR.UPPER_5M) {
    return "2M_TO_5M";
  }
  return "OVER_5M";
}

/** Real `city` preferred over `province` (finer-grained, same precedence `listing-readiness.ts`'s `checkLocation` gives `city`) — `undefined` when the listing has neither, meaning its area honestly cannot be compared against anything. */
export function resolveArea(
  city: string | undefined,
  province: string | undefined,
): string | undefined {
  if (city !== undefined && city.length > 0) {
    return city;
  }
  if (province !== undefined && province.length > 0) {
    return province;
  }
  return undefined;
}

export interface StrategyMemoryTarget {
  readonly propertyType: PropertyType | "UNSPECIFIED";
  readonly price: number;
  readonly city?: string;
  readonly province?: string;
  readonly objectiveMetric: string;
}

export interface StrategyMemoryCandidate {
  readonly listingId: string;
  readonly metaCampaignId: string;
  readonly propertyType: PropertyType | "UNSPECIFIED";
  readonly price: number;
  readonly city?: string;
  readonly province?: string;
  readonly objectiveMetric: string;
  /** Real `overallStatus` off the LATEST `samantha_campaign_assessments` row recorded for this `metaCampaignId` (`CampaignAssessmentRepository.listLatestPerCampaign`, newest-first, one row picked per campaign). */
  readonly overallStatus: HealthStatus;
  /** Real `health.costEfficiency.score` off that same latest row — `undefined` exactly when that dimension was itself `UNKNOWN` (no benchmark, or no leads that period) — never guessed. */
  readonly costEfficiencyScore?: number;
  readonly assessedAt: string;
}

/** Minimum real, distinct matched historical campaigns before an aggregate is honestly reportable. Deliberately small (real campaigns are a far scarcer resource than the impression/lead counts `data-sufficiency.ts` gates on) but still real — 1-2 data points is not a trend, it's an anecdote. */
export const MIN_HISTORICAL_SAMPLE_SIZE = 3;

export interface StrategyMemoryStatusCounts {
  readonly HEALTHY: number;
  readonly WATCH: number;
  readonly WARNING: number;
  readonly CRITICAL: number;
  readonly UNKNOWN: number;
}

export interface StrategyMemoryAvailable {
  readonly available: true;
  readonly matchedCount: number;
  readonly statusCounts: StrategyMemoryStatusCounts;
  /** `(HEALTHY + WATCH) / (matchedCount - UNKNOWN)` — the real fraction of matched historical campaigns whose LATEST assessment was not in a WARNING/CRITICAL state. `undefined` when every matched candidate's latest status is `UNKNOWN` (nothing real to divide by). */
  readonly favorableStatusRatio?: number;
  /** Mean `costEfficiencyScore` across matched candidates that HAD a real, defined one. `undefined` when none did. */
  readonly averageCostEfficiencyScore?: number;
  /** How many of `matchedCount` actually contributed to `averageCostEfficiencyScore` — always reported alongside it so a caller never mistakes a thin sub-sample for the full `matchedCount`. */
  readonly costEfficiencySampleSize: number;
  /** Indonesian, honest — e.g. "Reuse principle" reminder, or a note that some matched candidates still have `overallStatus: UNKNOWN`. Never a directive to clone. */
  readonly notes: readonly string[];
}

export interface StrategyMemoryUnavailable {
  readonly available: false;
  readonly matchedCount: number;
  readonly reason: string;
}

export type StrategyMemoryResult = StrategyMemoryAvailable | StrategyMemoryUnavailable;

/** `true` exactly when all four raw-spec criteria — property type, price segment, area, objective — genuinely match. Area is never force-matched when either side has no real `city`/`province`. */
export function matchesTarget(
  target: StrategyMemoryTarget,
  candidate: StrategyMemoryCandidate,
): boolean {
  if (target.propertyType !== candidate.propertyType) {
    return false;
  }
  if (resolvePriceSegment(target.price) !== resolvePriceSegment(candidate.price)) {
    return false;
  }
  const targetArea = resolveArea(target.city, target.province);
  const candidateArea = resolveArea(candidate.city, candidate.province);
  if (targetArea === undefined || candidateArea === undefined || targetArea !== candidateArea) {
    return false;
  }
  if (target.objectiveMetric !== candidate.objectiveMetric) {
    return false;
  }
  return true;
}

function emptyStatusCounts(): StrategyMemoryStatusCounts {
  return { HEALTHY: 0, WATCH: 0, WARNING: 0, CRITICAL: 0, UNKNOWN: 0 };
}

/**
 * Real matching + real aggregation, in one pure pass over `candidates` — no I/O. The caller
 * (`CampaignCreationService.getStrategyMemory`) already resolved every candidate's real listing
 * attributes + real latest assessment; this function only decides which ones count as "the same
 * strategy shape" and honestly summarizes their real outcomes.
 */
export function summarizeStrategyMemory(
  target: StrategyMemoryTarget,
  candidates: readonly StrategyMemoryCandidate[],
): StrategyMemoryResult {
  const matched = candidates.filter((candidate) => matchesTarget(target, candidate));

  if (matched.length < MIN_HISTORICAL_SAMPLE_SIZE) {
    return {
      available: false,
      matchedCount: matched.length,
      reason:
        matched.length === 0
          ? "Belum ada campaign historis dengan tipe properti, segmen harga, area, dan objective yang sama — belum ada preseden nyata untuk dipelajari."
          : `Baru ada ${String(matched.length)} campaign historis yang cocok (tipe properti, segmen harga, area, objective sama) — di bawah ambang minimum ${String(MIN_HISTORICAL_SAMPLE_SIZE)} untuk rata-rata yang bisa diandalkan.`,
    };
  }

  const statusCounts = matched.reduce<StrategyMemoryStatusCounts>((counts, candidate) => {
    return { ...counts, [candidate.overallStatus]: counts[candidate.overallStatus] + 1 };
  }, emptyStatusCounts());

  const knownStatusCount = matched.length - statusCounts.UNKNOWN;
  const favorableStatusRatio =
    knownStatusCount > 0
      ? (statusCounts.HEALTHY + statusCounts.WATCH) / knownStatusCount
      : undefined;

  const costEfficiencyScores = matched
    .map((candidate) => candidate.costEfficiencyScore)
    .filter((score): score is number => score !== undefined);
  const averageCostEfficiencyScore =
    costEfficiencyScores.length > 0
      ? costEfficiencyScores.reduce((sum, score) => sum + score, 0) / costEfficiencyScores.length
      : undefined;

  const notes: string[] = [
    "Ini rangkuman preseden historis, BUKAN template untuk di-clone mentah-mentah — tetap sesuaikan dengan kondisi listing ini.",
  ];
  if (statusCounts.UNKNOWN > 0) {
    notes.push(
      `${String(statusCounts.UNKNOWN)} dari ${String(matched.length)} campaign historis yang cocok belum punya overallStatus yang bisa dinilai (data belum cukup saat penilaian terakhirnya).`,
    );
  }
  if (costEfficiencyScores.length < matched.length) {
    notes.push(
      `Rata-rata cost-efficiency hanya dihitung dari ${String(costEfficiencyScores.length)} dari ${String(matched.length)} campaign historis yang punya skor cost-efficiency nyata.`,
    );
  }

  return {
    available: true,
    matchedCount: matched.length,
    statusCounts,
    ...(favorableStatusRatio !== undefined ? { favorableStatusRatio } : {}),
    ...(averageCostEfficiencyScore !== undefined ? { averageCostEfficiencyScore } : {}),
    costEfficiencySampleSize: costEfficiencyScores.length,
    notes,
  };
}
