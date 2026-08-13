import type { BranchId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ClosingType, type Closing } from "@aos/lead-store";

import { ClosingReportBuilder } from "../../builders/ClosingReportBuilder.js";
import type { ClosingTrackerConfig } from "../../config/ClosingTrackerConfig.js";
import type { IAttributionEngine } from "../../contracts/IAttributionEngine.js";
import type { ClosingDataset, IClosingAggregator } from "../../contracts/IClosingAggregator.js";
import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import { BranchPerformance } from "../../domain/entities/BranchPerformance.js";
import type { CampaignAttribution } from "../../domain/entities/CampaignAttribution.js";
import type { ClosingReport } from "../../domain/entities/ClosingReport.js";
import { SalesPerformance } from "../../domain/entities/SalesPerformance.js";
import { UnitPerformance } from "../../domain/entities/UnitPerformance.js";
import { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import {
  ClosingRate,
  RphSpk,
  TotalCommission,
  type ReportPeriod,
} from "../../domain/value-objects/index.js";

/** Zero-value dataset stand-in for a previous period that failed to load (e.g. no data yet exists before the tracker's first month) — trend deltas simply read as the full current-period value against a zero baseline. */
function emptyDataset(period: ReportPeriod): ClosingDataset {
  return {
    period,
    closings: [],
    stats: {
      totalClosings: 0,
      totalCommissionIdr: 0,
      avgCommissionIdr: 0,
      closingsByCampaign: {},
      rphSpkByCampaign: {},
      closingsByBranch: {},
    },
  };
}

function distinctLeadCount(closings: ReadonlyArray<Closing>): number {
  return new Set(closings.map((c) => c.leadId.toString())).size;
}

function totalsFor(closings: ReadonlyArray<Closing>): {
  totalTestDrives: number;
  totalSpk: number;
  totalCancelled: number;
} {
  return {
    totalTestDrives: closings.filter((c) => c.closingType === ClosingType.TEST_DRIVE).length,
    totalSpk: closings.filter((c) => c.closingType === ClosingType.SPK).length,
    totalCancelled: closings.filter((c) => c.closingType === ClosingType.CANCELLED).length,
  };
}

/**
 * Composes a full `ClosingReport` for a period (spec: "ReportGeneratorService"). Aggregates the
 * current period's closings, runs the attribution engine, computes `BranchPerformance`/
 * `UnitPerformance`/`SalesPerformance`, and diffs against the previous calendar month for
 * `vsLastMonth`.
 */
export class ReportGeneratorService implements IReportGenerator {
  constructor(
    private readonly closingAggregator: IClosingAggregator,
    private readonly attributionEngine: IAttributionEngine,
    private readonly config: ClosingTrackerConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly idGenerator: () => string = () => crypto.randomUUID(),
  ) {}

  async generate(period: ReportPeriod): Promise<Result<ClosingReport, ClosingTrackerError>> {
    const datasetResult = await this.closingAggregator.aggregate(period);
    if (!datasetResult.ok) {
      return err(datasetResult.error);
    }
    const dataset = datasetResult.value;

    const prevPeriod = period.previousMonth();
    const prevDatasetResult = await this.closingAggregator.aggregate(prevPeriod);
    const prevDataset = prevDatasetResult.ok ? prevDatasetResult.value : emptyDataset(prevPeriod);

    const attributionsResult = await this.attributionEngine.attribute(dataset);
    if (!attributionsResult.ok) {
      return err(
        new ClosingTrackerError(
          `ReportGeneratorService: attribution failed — ${attributionsResult.error.message}`,
          { cause: attributionsResult.error },
        ),
      );
    }
    const attributions = attributionsResult.value;

    const { totalTestDrives, totalSpk, totalCancelled } = totalsFor(dataset.closings);
    const overallHotLeads = distinctLeadCount(dataset.closings);
    const totalCommissionIdr = TotalCommission.fromAmounts(
      dataset.closings.map((c) => c.commissionIdr),
    );
    const closingRate = ClosingRate.fromCounts(totalSpk, overallHotLeads);
    const testDriveToSpkRate = ClosingRate.fromCounts(totalSpk, totalTestDrives);

    const { topCampaign, worstCampaign } = this.selectTopAndWorst(attributions);
    const byBranch = this.buildBranchPerformance(dataset.closings, attributions);
    const byUnit = this.buildUnitPerformance(dataset.closings);
    const bySales = this.buildSalesPerformance(dataset.closings);

    const prevTotals = totalsFor(prevDataset.closings);
    const prevHotLeads = distinctLeadCount(prevDataset.closings);
    const prevClosingRate = ClosingRate.fromCounts(prevTotals.totalSpk, prevHotLeads);
    const prevCommission = TotalCommission.fromAmounts(
      prevDataset.closings.map((c) => c.commissionIdr),
    );

    const built = ClosingReportBuilder.create()
      .withId(this.idGenerator())
      .withPeriod(period)
      .withGeneratedAt(this.now())
      .withTotals(totalTestDrives, totalSpk, totalCancelled)
      .withCommission(totalCommissionIdr)
      .withRates(closingRate, testDriveToSpkRate)
      .withCampaignAttributions(attributions, topCampaign, worstCampaign)
      .withDimensions(byBranch, byUnit, bySales)
      .withTrend({
        spkDelta: totalSpk - prevTotals.totalSpk,
        rateDelta: closingRate.value - prevClosingRate.value,
        commissionDelta: totalCommissionIdr.value - prevCommission.value,
      })
      .build();

    /* v8 ignore start -- every field fed into the builder above is already valid by construction
       (non-negative counts, valid BranchId/verdict values, a non-empty generated id) — the
       builder's own validation can never actually fail here. Kept as an explicit guard rather
       than an unsafe unwrap. */
    if (!built.ok) {
      return err(
        new ClosingTrackerError(
          `ReportGeneratorService: failed to build ClosingReport — ${built.error.message}`,
          {
            cause: built.error,
          },
        ),
      );
    }
    /* v8 ignore stop */
    return ok(built.value);
  }

  /**
   * **Coordinator note #4**: `minSpkForAttribution` gates `topCampaign`/`worstCampaign` selection
   * — campaigns with fewer SPK than this threshold are excluded, since a single (or zero) SPK
   * data point isn't a reliable enough signal to declare "best"/"worst". `topCampaign` is the
   * lowest `rphSpk` among qualifying campaigns (cheapest cost per SPK — most profitable);
   * `worstCampaign` is the highest. Both are `null` when no campaign qualifies.
   */
  private selectTopAndWorst(attributions: ReadonlyArray<CampaignAttribution>): {
    topCampaign: CampaignAttribution | null;
    worstCampaign: CampaignAttribution | null;
  } {
    const qualifying = attributions.filter((a) => a.totalSpk >= this.config.minSpkForAttribution);
    if (qualifying.length === 0) {
      return { topCampaign: null, worstCampaign: null };
    }
    let top = qualifying[0] as CampaignAttribution;
    let worst = qualifying[0] as CampaignAttribution;
    for (const attribution of qualifying) {
      if (attribution.rphSpk.value < top.rphSpk.value) {
        top = attribution;
      }
      if (attribution.rphSpk.value > worst.rphSpk.value) {
        worst = attribution;
      }
    }
    return { topCampaign: top, worstCampaign: worst };
  }

  private buildBranchPerformance(
    closings: ReadonlyArray<Closing>,
    attributions: ReadonlyArray<CampaignAttribution>,
  ): ReadonlyArray<BranchPerformance> {
    const byBranch = new Map<BranchId, Closing[]>();
    for (const closing of closings) {
      const list = byBranch.get(closing.branchId) ?? [];
      list.push(closing);
      byBranch.set(closing.branchId, list);
    }

    const results: BranchPerformance[] = [];
    for (const [branch, branchClosings] of byBranch) {
      const totals = totalsFor(branchClosings);
      const hotLeads = distinctLeadCount(branchClosings);
      const totalCommissionIdr = branchClosings.reduce((sum, c) => sum + (c.commissionIdr ?? 0), 0);
      // avgRphSpk: total spend of every campaign attribution rooted in this branch, divided by the
      // branch's total SPK — the attribution engine is the only source of spend in this package.
      const branchSpend = attributions
        .filter((a) => a.branch === branch)
        .reduce((sum, a) => sum + a.totalSpend, 0);
      const avgRphSpk = RphSpk.fromSpendAndSpk(branchSpend, totals.totalSpk);
      const topSalesName = this.topSalesHumanIdIn(branchClosings);

      const created = BranchPerformance.create({
        branch,
        totalSpk: totals.totalSpk,
        totalTestDrives: totals.totalTestDrives,
        closingRate: ClosingRate.fromCounts(totals.totalSpk, hotLeads),
        totalCommissionIdr,
        avgRphSpk,
        topSalesName,
      });
      /* v8 ignore start -- branch is always a valid BranchId (sourced from Closing.branchId), all
         numeric fields are non-negative by construction; BranchPerformance.create cannot fail. */
      if (!created.ok) {
        continue;
      }
      /* v8 ignore stop */
      results.push(created.value);
    }
    return results;
  }

  private buildUnitPerformance(closings: ReadonlyArray<Closing>): ReadonlyArray<UnitPerformance> {
    const byUnit = new Map<string, Closing[]>();
    for (const closing of closings) {
      if (closing.unitModel === undefined) {
        continue;
      }
      const list = byUnit.get(closing.unitModel) ?? [];
      list.push(closing);
      byUnit.set(closing.unitModel, list);
    }

    const results: UnitPerformance[] = [];
    for (const [unitModel, unitClosings] of byUnit) {
      const totals = totalsFor(unitClosings);
      const hotLeads = distinctLeadCount(unitClosings);
      const spkClosings = unitClosings.filter((c) => c.closingType === ClosingType.SPK);
      const avgSpkValue =
        spkClosings.length > 0
          ? spkClosings.reduce((sum, c) => sum + (c.unitPrice ?? 0), 0) / spkClosings.length
          : 0;
      const avgCommission =
        spkClosings.length > 0
          ? spkClosings.reduce((sum, c) => sum + (c.commissionIdr ?? 0), 0) / spkClosings.length
          : 0;
      const topBranch = this.topBranchIn(unitClosings);

      const created = UnitPerformance.create({
        unitModel,
        totalSpk: totals.totalSpk,
        avgSpkValue,
        avgCommission,
        closingRate: ClosingRate.fromCounts(totals.totalSpk, hotLeads),
        topBranch,
      });
      /* v8 ignore start -- unitModel is a non-empty string (filtered above), all numeric fields
         are non-negative by construction, topBranch is always a valid BranchId. */
      if (!created.ok) {
        continue;
      }
      /* v8 ignore stop */
      results.push(created.value);
    }
    return results;
  }

  private buildSalesPerformance(closings: ReadonlyArray<Closing>): ReadonlyArray<SalesPerformance> {
    const bySales = new Map<string, Closing[]>();
    for (const closing of closings) {
      const id = closing.salesHumanId.toString();
      const list = bySales.get(id) ?? [];
      list.push(closing);
      bySales.set(id, list);
    }

    const results: SalesPerformance[] = [];
    for (const [salesHumanId, salesClosings] of bySales) {
      const totals = totalsFor(salesClosings);
      const hotLeads = distinctLeadCount(salesClosings);
      const totalCommissionIdr = salesClosings.reduce((sum, c) => sum + (c.commissionIdr ?? 0), 0);
      const branch = (salesClosings[0] as Closing).branchId;

      const created = SalesPerformance.create({
        salesHumanId,
        salesHumanName: salesHumanId,
        branch,
        totalSpk: totals.totalSpk,
        totalTestDrives: totals.totalTestDrives,
        closingRate: ClosingRate.fromCounts(totals.totalSpk, hotLeads),
        totalCommissionIdr,
      });
      /* v8 ignore start -- salesHumanId is always a non-empty string, branch is always a valid
         BranchId, all numeric fields non-negative by construction. */
      if (!created.ok) {
        continue;
      }
      /* v8 ignore stop */
      results.push(created.value);
    }
    return results;
  }

  private topSalesHumanIdIn(closings: ReadonlyArray<Closing>): string {
    const spkCountBySales = new Map<string, number>();
    for (const closing of closings) {
      if (closing.closingType !== ClosingType.SPK) {
        continue;
      }
      const id = closing.salesHumanId.toString();
      spkCountBySales.set(id, (spkCountBySales.get(id) ?? 0) + 1);
    }
    let topId = "";
    let topCount = -1;
    for (const [id, count] of spkCountBySales) {
      if (count > topCount) {
        topId = id;
        topCount = count;
      }
    }
    // When the branch group has no SPK closings at all (e.g. test drives only), fall back to the
    // first closing's sales human rather than an empty string — buildBranchPerformance only ever
    // calls this with a non-empty closings group, so closings[0] always exists.
    return topId.length > 0 ? topId : (closings[0] as Closing).salesHumanId.toString();
  }

  private topBranchIn(closings: ReadonlyArray<Closing>): BranchId {
    const spkCountByBranch = new Map<BranchId, number>();
    for (const closing of closings) {
      if (closing.closingType !== ClosingType.SPK) {
        continue;
      }
      spkCountByBranch.set(closing.branchId, (spkCountByBranch.get(closing.branchId) ?? 0) + 1);
    }
    let topBranch: BranchId | undefined;
    let topCount = -1;
    for (const [branch, count] of spkCountByBranch) {
      if (count > topCount) {
        topBranch = branch;
        topCount = count;
      }
    }
    // When the unit group has no SPK closings at all, fall back to the first closing's branch —
    // buildUnitPerformance only ever calls this with a non-empty closings group.
    return topBranch ?? (closings[0] as Closing).branchId;
  }
}
