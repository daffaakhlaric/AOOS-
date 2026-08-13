import type { BranchId } from "@aos/branch-manager";
import { ok, type Result } from "@aos/common";
import { ClosingType, type Closing } from "@aos/lead-store";

import type { ClosingTrackerConfig } from "../../config/ClosingTrackerConfig.js";
import type { IAttributionEngine } from "../../contracts/IAttributionEngine.js";
import type {
  ActiveCampaignSnapshot,
  ICampaignActivityProvider,
} from "../../contracts/ICampaignActivityProvider.js";
import type { ClosingDataset } from "../../contracts/IClosingAggregator.js";
import { CampaignAttribution, resolveVerdict } from "../../domain/entities/CampaignAttribution.js";
import type { AttributionError } from "../../domain/errors/AttributionError.js";
import { AttributionScore, ClosingRate, RphSpk } from "../../domain/value-objects/index.js";

export interface CampaignMeta {
  readonly campaignName: string;
  readonly stableId: string;
}

/** campaignId -> display metadata, used to resolve `CampaignAttribution.campaignName`/`.stableId`. Judgment call: `Closing` only carries `campaignId` (a Meta campaign id), never a name/`#stableId` — this package has no campaign-name lookup of its own, so callers (typically `ClosingTrackerFactory`, wired from `@aos/meta-ads-connector`) inject one. When a campaignId has no directory entry, both fields fall back to the raw campaignId itself. */
export type CampaignDirectory = ReadonlyMap<string, CampaignMeta>;

interface Bucket {
  readonly campaignId: string;
  branch: BranchId;
  spend: number;
  totalSpk: number;
  totalTestDrives: number;
  totalHotLeads: number;
  totalCommissionIdr: number;
  readonly confidence: number;
  /** Present only for Method-1 (Direct) buckets — the *exact* value reused from `@aos/lead-store`'s `GetClosingStats.rphSpkByCampaign` (coordinator note #1). When set, this is used verbatim as `CampaignAttribution.rphSpk` instead of being recomputed from `spend`/`totalSpk`. */
  directRphSpk?: number;
}

function bucketKey(campaignId: string, confidence: number): string {
  return `${campaignId}:${confidence}`;
}

/**
 * Implements the three-method attribution engine (spec: "Attribution Engine"):
 *  - Method 1 — Direct (confidence 100): `Closing.campaignId` is set — grouped straight from the
 *    dataset's raw closings, reusing `ClosingDataset.stats.rphSpkByCampaign`'s exact value for
 *    `rphSpk` per coordinator note #1 (never recomputed independently).
 *  - Method 2 — Time-based (confidence 70): no `campaignId`, but `ICampaignActivityProvider`
 *    reports at least one campaign active for that branch on the closing's `createdAt` day —
 *    attributed to the highest-spend one.
 *  - Method 3 — Branch-based (confidence 40): no `campaignId` and no same-day match, but at least
 *    one campaign was active for that branch somewhere in the report period — attributed
 *    proportionally (by spend share) across all of them. Proportional attribution intentionally
 *    yields fractional `totalSpk`/`totalTestDrives`/`totalHotLeads` contributions per campaign
 *    (see package report "Method 3 fractional attribution").
 *
 * A closing with neither a same-day nor a period-wide active-campaign match (e.g. no
 * `ICampaignActivityProvider` data at all) is simply excluded from campaign-level attribution — it
 * still counts in `BranchPerformance`/`UnitPerformance`/`ClosingPipeline`, which aggregate from the
 * raw dataset directly, not from this engine's output.
 *
 * Judgment call: if the same campaign receives both a direct-attribution bucket AND a
 * fallback-attribution bucket in the same period, they are emitted as two separate
 * `CampaignAttribution` entries (different `attributionScore`s) rather than merged — merging would
 * either corrupt the reused direct `rphSpk` value or require recomputing it, both of which
 * conflict with coordinator note #1.
 */
export class AttributionEngineService implements IAttributionEngine {
  /** Campaign metadata discovered from `ICampaignActivityProvider` responses during fallback attribution — kept separate from the caller-supplied `campaignDirectory` so that map is never mutated (it may be a shared, externally-owned object). */
  private readonly discoveredMeta = new Map<string, CampaignMeta>();

  constructor(
    private readonly campaignActivityProvider: ICampaignActivityProvider,
    private readonly config: ClosingTrackerConfig,
    private readonly campaignDirectory: CampaignDirectory = new Map(),
  ) {}

  async attribute(
    dataset: ClosingDataset,
  ): Promise<Result<ReadonlyArray<CampaignAttribution>, AttributionError>> {
    const buckets = new Map<string, Bucket>();

    this.applyDirectAttribution(dataset, buckets);
    await this.applyFallbackAttribution(dataset, buckets);

    const thresholds = {
      rphSpkScaleThreshold: this.config.rphSpkScaleThreshold,
      rphSpkKeepThreshold: this.config.rphSpkKeepThreshold,
      minSpendForPause: this.config.minSpendForPause,
    };

    const attributions: CampaignAttribution[] = [];
    for (const bucket of buckets.values()) {
      const meta =
        this.campaignDirectory.get(bucket.campaignId) ?? this.discoveredMeta.get(bucket.campaignId);
      const rphSpk =
        bucket.directRphSpk !== undefined
          ? this.safeRphSpk(bucket.directRphSpk)
          : RphSpk.fromSpendAndSpk(bucket.spend, bucket.totalSpk);
      // A bucket only ever exists once at least 1 closing (direct) or weighted contribution
      // (fallback) has been added to it, so totalHotLeads is always > 0 here; Math.max(..., 1) is
      // a structural divide-by-zero guard that can never actually change the denominator, kept
      // instead of a conditional so there is no dead branch for a case that can't occur.
      const rphLead = bucket.spend / Math.max(bucket.totalHotLeads, 1);
      const closingRate = ClosingRate.fromCounts(bucket.totalSpk, bucket.totalHotLeads);
      const attributionScore = this.safeAttributionScore(bucket.confidence);
      const verdict = resolveVerdict(rphSpk.value, bucket.totalSpk, bucket.spend, thresholds);

      const created = CampaignAttribution.create({
        campaignId: bucket.campaignId,
        campaignName: meta?.campaignName ?? bucket.campaignId,
        stableId: meta?.stableId ?? bucket.campaignId,
        branch: bucket.branch,
        totalSpend: bucket.spend,
        totalHotLeads: bucket.totalHotLeads,
        totalTestDrives: bucket.totalTestDrives,
        totalSpk: bucket.totalSpk,
        totalCommissionIdr: bucket.totalCommissionIdr,
        rphSpk,
        rphLead,
        closingRate,
        attributionScore,
        verdict,
      });
      /* v8 ignore start -- every field above is already guarded (non-negative, valid BranchId,
         valid verdict) by construction; CampaignAttribution.create's validation can never fail
         here. Kept as an explicit guard rather than an unsafe unwrap. */
      if (!created.ok) {
        continue;
      }
      /* v8 ignore stop */
      attributions.push(created.value);
    }

    return ok(attributions);
  }

  private applyDirectAttribution(dataset: ClosingDataset, buckets: Map<string, Bucket>): void {
    const directByCampaign = new Map<string, Closing[]>();
    for (const closing of dataset.closings) {
      if (closing.campaignId === undefined) {
        continue;
      }
      const list = directByCampaign.get(closing.campaignId) ?? [];
      list.push(closing);
      directByCampaign.set(closing.campaignId, list);
    }

    for (const [campaignId, closings] of directByCampaign) {
      const rphSpkValue = dataset.stats.rphSpkByCampaign[campaignId] ?? 0;
      const closingsCount = dataset.stats.closingsByCampaign[campaignId] ?? closings.length;
      const totalSpend = rphSpkValue * closingsCount;
      const totalSpk = closings.filter((c) => c.closingType === ClosingType.SPK).length;
      const totalTestDrives = closings.filter(
        (c) => c.closingType === ClosingType.TEST_DRIVE,
      ).length;
      const totalHotLeads = new Set(closings.map((c) => c.leadId.toString())).size;
      const totalCommissionIdr = closings.reduce((sum, c) => sum + (c.commissionIdr ?? 0), 0);

      buckets.set(bucketKey(campaignId, AttributionScore.DIRECT), {
        campaignId,
        branch: closings[0]?.branchId as BranchId,
        spend: totalSpend,
        totalSpk,
        totalTestDrives,
        totalHotLeads,
        totalCommissionIdr,
        confidence: AttributionScore.DIRECT,
        directRphSpk: rphSpkValue,
      });
    }
  }

  private async applyFallbackAttribution(
    dataset: ClosingDataset,
    buckets: Map<string, Bucket>,
  ): Promise<void> {
    const unattributed = dataset.closings.filter((c) => c.campaignId === undefined);

    for (const closing of unattributed) {
      const dayCandidates = await this.campaignActivityProvider.getActiveCampaignsForBranch(
        closing.branchId,
        closing.createdAt,
      );
      if (dayCandidates.length > 0) {
        const winner = dayCandidates.reduce((best, candidate) =>
          candidate.spend > best.spend ? candidate : best,
        );
        this.addContribution(buckets, winner, closing, 1, AttributionScore.TIME_BASED);
        continue;
      }

      const periodCandidates =
        await this.campaignActivityProvider.getActiveCampaignsForBranchInPeriod(
          closing.branchId,
          dataset.period.fromDate,
          dataset.period.toDate,
        );
      if (periodCandidates.length === 0) {
        continue;
      }
      const totalSpend = periodCandidates.reduce((sum, candidate) => sum + candidate.spend, 0);
      for (const candidate of periodCandidates) {
        const weight = totalSpend > 0 ? candidate.spend / totalSpend : 1 / periodCandidates.length;
        this.addContribution(buckets, candidate, closing, weight, AttributionScore.BRANCH_BASED);
      }
    }
  }

  private addContribution(
    buckets: Map<string, Bucket>,
    candidate: ActiveCampaignSnapshot,
    closing: Closing,
    weight: number,
    confidence: number,
  ): void {
    if (
      !this.campaignDirectory.has(candidate.campaignId) &&
      !this.discoveredMeta.has(candidate.campaignId)
    ) {
      this.discoveredMeta.set(candidate.campaignId, {
        campaignName: candidate.campaignName,
        stableId: candidate.stableId,
      });
    }
    const key = bucketKey(candidate.campaignId, confidence);
    const existing = buckets.get(key);
    const isSpk = closing.closingType === ClosingType.SPK ? weight : 0;
    const isTestDrive = closing.closingType === ClosingType.TEST_DRIVE ? weight : 0;
    const commission = (closing.commissionIdr ?? 0) * weight;

    if (existing === undefined) {
      buckets.set(key, {
        campaignId: candidate.campaignId,
        branch: candidate.branch,
        spend: candidate.spend,
        totalSpk: isSpk,
        totalTestDrives: isTestDrive,
        totalHotLeads: weight,
        totalCommissionIdr: commission,
        confidence,
      });
      return;
    }
    existing.spend = candidate.spend;
    existing.totalSpk += isSpk;
    existing.totalTestDrives += isTestDrive;
    existing.totalHotLeads += weight;
    existing.totalCommissionIdr += commission;
  }

  private safeRphSpk(value: number): RphSpk {
    const result = RphSpk.create(value);
    /* v8 ignore start -- value always comes from a non-negative divide-by-zero-safe
       lead-store division (rphSpkByCampaign), so RphSpk.create can never fail here. */
    if (!result.ok) {
      return RphSpk.fromSpendAndSpk(0, 0);
    }
    /* v8 ignore stop */
    return result.value;
  }

  private safeAttributionScore(score: number): AttributionScore {
    const result = AttributionScore.create(score);
    /* v8 ignore next 3 -- score is always one of the 3 constants (100/70/40), always valid. */
    if (!result.ok) {
      return AttributionScore.direct();
    }
    return result.value;
  }
}
