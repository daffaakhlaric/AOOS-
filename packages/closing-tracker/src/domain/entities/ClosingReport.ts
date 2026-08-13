import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ClosingRate, ReportPeriod, TotalCommission } from "../value-objects/index.js";

import type { BranchPerformance } from "./BranchPerformance.js";
import type { CampaignAttribution } from "./CampaignAttribution.js";
import type { SalesPerformance } from "./SalesPerformance.js";
import type { UnitPerformance } from "./UnitPerformance.js";

export interface ClosingReportTrend {
  readonly spkDelta: number; // +3, -2
  readonly rateDelta: number; // +0.05, -0.02
  readonly commissionDelta: number; // IDR delta
}

export interface ClosingReportProps {
  readonly id: string;
  readonly period: ReportPeriod;
  readonly generatedAt: Date;
  readonly totalTestDrives: number;
  readonly totalSpk: number;
  readonly totalCancelled: number;
  readonly totalCommissionIdr: TotalCommission;
  readonly closingRate: ClosingRate;
  readonly testDriveToSpkRate: ClosingRate;
  readonly campaignAttributions: ReadonlyArray<CampaignAttribution>;
  readonly topCampaign: CampaignAttribution | null;
  readonly worstCampaign: CampaignAttribution | null;
  readonly byBranch: ReadonlyArray<BranchPerformance>;
  readonly byUnit: ReadonlyArray<UnitPerformance>;
  readonly bySales: ReadonlyArray<SalesPerformance>;
  readonly vsLastMonth: ClosingReportTrend;
}

/** The aggregated closing report for one period — the main output of `GenerateClosingReport` (spec: "ClosingReport (Entity)"). */
export class ClosingReport {
  private constructor(private readonly props: ClosingReportProps) {}

  static create(props: ClosingReportProps): Result<ClosingReport, ValidationError> {
    if (typeof props.id !== "string" || props.id.trim().length === 0) {
      return err(new ValidationError("ClosingReport.id must be a non-empty string"));
    }
    for (const [field, value] of [
      ["totalTestDrives", props.totalTestDrives],
      ["totalSpk", props.totalSpk],
      ["totalCancelled", props.totalCancelled],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        return err(
          new ValidationError(
            `ClosingReport.${field} must be a non-negative integer, received: ${String(value)}`,
          ),
        );
      }
    }
    return ok(
      new ClosingReport({
        ...props,
        campaignAttributions: [...props.campaignAttributions],
        byBranch: [...props.byBranch],
        byUnit: [...props.byUnit],
        bySales: [...props.bySales],
      }),
    );
  }

  get id(): string {
    return this.props.id;
  }

  get period(): ReportPeriod {
    return this.props.period;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }

  get totalTestDrives(): number {
    return this.props.totalTestDrives;
  }

  get totalSpk(): number {
    return this.props.totalSpk;
  }

  get totalCancelled(): number {
    return this.props.totalCancelled;
  }

  get totalCommissionIdr(): TotalCommission {
    return this.props.totalCommissionIdr;
  }

  get closingRate(): ClosingRate {
    return this.props.closingRate;
  }

  get testDriveToSpkRate(): ClosingRate {
    return this.props.testDriveToSpkRate;
  }

  get campaignAttributions(): ReadonlyArray<CampaignAttribution> {
    return this.props.campaignAttributions;
  }

  get topCampaign(): CampaignAttribution | null {
    return this.props.topCampaign;
  }

  get worstCampaign(): CampaignAttribution | null {
    return this.props.worstCampaign;
  }

  get byBranch(): ReadonlyArray<BranchPerformance> {
    return this.props.byBranch;
  }

  get byUnit(): ReadonlyArray<UnitPerformance> {
    return this.props.byUnit;
  }

  get bySales(): ReadonlyArray<SalesPerformance> {
    return this.props.bySales;
  }

  get vsLastMonth(): ClosingReportTrend {
    return this.props.vsLastMonth;
  }
}
