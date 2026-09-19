import type { GrowthObjectiveResponseDto } from "../../growth-objectives/dto/growth-objective.dto.js";
import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

import { assessListingReadiness } from "./listing-readiness.js";
import type { ListingReadinessResult } from "./listing-readiness.js";

/**
 * EYVRA — SAMANTHA V2 Phase 32 (raw spec's "Portfolio Planner" / "Listing Allocation Engine" —
 * these two boxes appear together as `SAMANTHA GOAL PLANNER`'s `Listing Allocation` +
 * `Portfolio Strategy` branches in the spec's own `FINAL ARCHITECTURE` diagram; this codebase
 * implements them as one function since a portfolio PLAN and a listing ALLOCATION are the same
 * real output — a ranked candidate list plus a target/budget split across the ready ones).
 *
 * Pure, deterministic, no I/O — given ONE Growth Objective's real target/forecast and a tenant's
 * REAL candidate listings (already fetched by the caller — `CampaignCreationService`), decides:
 *   1. which listings are real candidates at all (see `resolveCandidacy` doc on the caller side —
 *      this function receives an already-resolved candidate list, it does not decide inclusion),
 *   2. per candidate, real readiness (`assessListingReadiness` — REUSED, never reimplemented) and
 *      real existing-campaign linkage (`matchedCampaignIdsByListingId` — REUSED from
 *      `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings`, never reimplemented),
 *   3. for the subset that is both `readiness.ready` AND has NO existing campaign linkage yet
 *      (`eligibleForAllocation`), a real target-hot-lead / budget split.
 *
 * ALLOCATION MODEL — HONEST, STATED EXPLICITLY: an EVEN SPLIT of `growthObjective.targetValue`
 * (hot leads) and, when available, `forecast.reverseFunnel.estimatedMediaSpendIdr.expected`
 * (budget) across every `eligibleForAllocation` listing. This codebase has NO real per-listing
 * signal that would justify a WEIGHTED split — no historical per-listing conversion rate, no
 * per-listing CPL, no "listing quality score" anywhere in this schema. Inventing one would be
 * exactly the kind of fabricated precision this whole session's discipline forbids. An even split
 * is not a placeholder — it is the honest default when no real weighting signal exists, and this
 * file says so rather than dressing up `1/N` as something smarter than it is. A future phase that
 * builds a REAL per-listing performance history (e.g. after `Historical Strategy Memory` — the raw
 * spec's own next box — accumulates real data) would have real grounds to replace this.
 *
 * Remainder handling: `targetValue` and `estimatedMediaSpendIdr` rarely divide evenly by the
 * eligible count. Plain integer division would silently under-allocate (the shares would sum to
 * LESS than the real total). Instead, the remainder is distributed one unit at a time to the first
 * `remainder` eligible listings (stable order — by `listingId` ascending, applied by the caller
 * before this function ever sees the array — see `campaign-creation.service.ts`), so
 * `sum(shares) === total` exactly, always. This is still an honest even split (every listing gets
 * `floor` or `floor + 1`, never a fabricated weight), just one that doesn't quietly lose leads/rupiah
 * to rounding.
 */

export interface PortfolioAllocationShare {
  readonly targetHotLeads: number;
  /** `undefined` exactly when the objective has no `forecast` yet (see `PortfolioPlanResult.totalEstimatedMediaSpendIdr` doc) — never a guessed number. */
  readonly budgetIdr?: number;
}

export interface PortfolioCandidate {
  readonly listingId: string;
  readonly listingTitle: string;
  readonly readiness: ListingReadinessResult;
  /** `true` when `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings` already found at least one real synced `meta_campaigns` row linked to this listing (any status — this codebase's real linkage data makes no ACTIVE/PAUSED distinction available here; see that repository's own doc). Excluded from allocation either way — never double-budgeted. */
  readonly alreadyCampaigned: boolean;
  /** Real matched `meta_campaign_id`s backing `alreadyCampaigned` — always `[]` when `alreadyCampaigned` is `false`. */
  readonly matchedCampaignIds: readonly string[];
  /** `true` exactly when `readiness.ready && !alreadyCampaigned` — the only listings this plan allocates target/budget to. */
  readonly eligibleForAllocation: boolean;
  /** Present exactly when `eligibleForAllocation` is `true`. */
  readonly allocation?: PortfolioAllocationShare;
}

export interface PortfolioPlanResult {
  readonly growthObjectiveId: string;
  /** `growthObjective.targetValue` — real, always present regardless of whether `/analyze` has run. */
  readonly totalTargetHotLeads: number;
  /** `growthObjective.forecast?.reverseFunnel.estimatedMediaSpendIdr?.expected` — `undefined` until `/analyze` has produced a real projected spend (either the objective was never analyzed, or its historical sample was too thin for `computeReverseFunnel` to project a spend at all). Never guessed from `totalTargetHotLeads` alone. */
  readonly totalEstimatedMediaSpendIdr?: number;
  readonly candidates: readonly PortfolioCandidate[];
  readonly eligibleCount: number;
  /** Always `"EVEN_SPLIT"` today — see this file's header doc for why that is the honest choice, not a fabricated weighting model. */
  readonly allocationModel: "EVEN_SPLIT";
  /** Every honest gap/degrade found while building this plan — zero candidates, zero eligible candidates, no forecast yet, focus listings that no longer exist. Indonesian, specific — same tone `campaign-blueprint.ts`'s `warnings` establishes. */
  readonly warnings: readonly string[];
}

export interface PortfolioPlanInput {
  readonly growthObjective: GrowthObjectiveResponseDto;
  /** The tenant's real candidate listings, already resolved by the caller (see `CampaignCreationService.getPortfolioPlan`'s own doc for the real `focusListingIds`-vs-"every listing" rule) — this function stays pure and never decides candidacy itself. */
  readonly candidateListings: readonly ListingResponseDto[];
  /** Real matched `meta_campaign_id`s per listing id, from `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings` — one real I/O call the caller already made per candidate listing. A listing id absent from this map is treated the same as an empty array (no known linkage). */
  readonly matchedCampaignIdsByListingId: ReadonlyMap<string, readonly string[]>;
}

/** Splits `total` into `count` non-negative integer shares that sum EXACTLY to `total` — `floor(total/count)` each, with the remainder (`total % count`) distributed one unit to the first `remainder` entries (by array order, which the caller sorts by `listingId` ascending for a stable, reproducible split). `count === 0` returns `[]` (guarded by the caller — never divides by zero here). */
function evenSplit(total: number, count: number): readonly number[] {
  if (count === 0) {
    return [];
  }
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function planPortfolioAllocation(input: PortfolioPlanInput): PortfolioPlanResult {
  const { growthObjective, candidateListings, matchedCampaignIdsByListingId } = input;
  const warnings: string[] = [];

  if (candidateListings.length === 0) {
    warnings.push(
      "Tidak ada listing kandidat untuk growth objective ini — tidak ada listing tenant yang bisa dialokasikan.",
    );
  }

  const totalEstimatedMediaSpendIdr =
    growthObjective.forecast?.reverseFunnel.estimatedMediaSpendIdr?.expected;
  if (growthObjective.forecast === undefined) {
    warnings.push(
      "Growth objective belum dianalisa (POST /growth-objectives/:id/analyze) — alokasi budget belum bisa dihitung, hanya alokasi target hot lead.",
    );
  } else if (totalEstimatedMediaSpendIdr === undefined) {
    warnings.push(
      "Growth objective sudah dianalisa tapi belum punya proyeksi media spend (data historis terlalu tipis) — alokasi budget belum bisa dihitung, hanya alokasi target hot lead.",
    );
  }

  const unallocated = candidateListings.map((listing) => {
    const readiness = assessListingReadiness(listing);
    const matchedCampaignIds = matchedCampaignIdsByListingId.get(listing.id) ?? [];
    const alreadyCampaigned = matchedCampaignIds.length > 0;
    const eligibleForAllocation = readiness.ready && !alreadyCampaigned;
    return { listing, readiness, matchedCampaignIds, alreadyCampaigned, eligibleForAllocation };
  });

  const eligible = unallocated.filter((c) => c.eligibleForAllocation);

  if (candidateListings.length > 0 && eligible.length === 0) {
    const anyBlocked = unallocated.some((c) => !c.readiness.ready);
    const anyCampaigned = unallocated.some((c) => c.alreadyCampaigned);
    if (anyBlocked && !anyCampaigned) {
      warnings.push(
        "Semua listing kandidat terblokir oleh readiness issue — lihat blockingIssues masing-masing listing.",
      );
    } else if (anyCampaigned && !anyBlocked) {
      warnings.push(
        "Semua listing kandidat sudah punya campaign — tidak ada listing baru yang bisa dialokasikan.",
      );
    } else {
      warnings.push(
        "Semua listing kandidat sudah punya campaign atau terblokir oleh readiness issue — tidak ada listing baru yang bisa dialokasikan.",
      );
    }
  }

  const targetShares = evenSplit(growthObjective.targetValue, eligible.length);
  const budgetShares =
    totalEstimatedMediaSpendIdr === undefined
      ? undefined
      : evenSplit(totalEstimatedMediaSpendIdr, eligible.length);

  let eligibleIndex = 0;
  const candidates: readonly PortfolioCandidate[] = unallocated.map((c) => {
    if (!c.eligibleForAllocation) {
      return {
        listingId: c.listing.id,
        listingTitle: c.listing.title,
        readiness: c.readiness,
        alreadyCampaigned: c.alreadyCampaigned,
        matchedCampaignIds: c.matchedCampaignIds,
        eligibleForAllocation: false,
      };
    }
    const index = eligibleIndex;
    eligibleIndex += 1;
    const allocation: PortfolioAllocationShare = {
      targetHotLeads: targetShares[index] ?? 0,
      ...(budgetShares !== undefined ? { budgetIdr: budgetShares[index] ?? 0 } : {}),
    };
    return {
      listingId: c.listing.id,
      listingTitle: c.listing.title,
      readiness: c.readiness,
      alreadyCampaigned: c.alreadyCampaigned,
      matchedCampaignIds: c.matchedCampaignIds,
      eligibleForAllocation: true,
      allocation,
    };
  });

  return {
    growthObjectiveId: growthObjective.id,
    totalTargetHotLeads: growthObjective.targetValue,
    ...(totalEstimatedMediaSpendIdr !== undefined ? { totalEstimatedMediaSpendIdr } : {}),
    candidates,
    eligibleCount: eligible.length,
    allocationModel: "EVEN_SPLIT",
    warnings,
  };
}
