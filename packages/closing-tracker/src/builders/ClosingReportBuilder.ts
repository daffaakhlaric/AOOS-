import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import {
  ClosingReport,
  type ClosingReportProps,
  type ClosingReportTrend,
} from "../domain/entities/ClosingReport.js";

/** Fluent builder for `ClosingReport` (spec: "Builder Pattern"). Every setter returns a new builder instance — never mutates in place. */
export class ClosingReportBuilder {
  private constructor(private readonly props: Partial<ClosingReportProps>) {}

  static create(): ClosingReportBuilder {
    return new ClosingReportBuilder({});
  }

  withId(id: string): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, id });
  }

  withPeriod(period: ClosingReportProps["period"]): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, period });
  }

  withGeneratedAt(generatedAt: Date): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, generatedAt });
  }

  withTotals(
    totalTestDrives: number,
    totalSpk: number,
    totalCancelled: number,
  ): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, totalTestDrives, totalSpk, totalCancelled });
  }

  withCommission(
    totalCommissionIdr: ClosingReportProps["totalCommissionIdr"],
  ): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, totalCommissionIdr });
  }

  withRates(
    closingRate: ClosingReportProps["closingRate"],
    testDriveToSpkRate: ClosingReportProps["testDriveToSpkRate"],
  ): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, closingRate, testDriveToSpkRate });
  }

  withCampaignAttributions(
    campaignAttributions: ClosingReportProps["campaignAttributions"],
    topCampaign: ClosingReportProps["topCampaign"],
    worstCampaign: ClosingReportProps["worstCampaign"],
  ): ClosingReportBuilder {
    return new ClosingReportBuilder({
      ...this.props,
      campaignAttributions,
      topCampaign,
      worstCampaign,
    });
  }

  withDimensions(
    byBranch: ClosingReportProps["byBranch"],
    byUnit: ClosingReportProps["byUnit"],
    bySales: ClosingReportProps["bySales"],
  ): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, byBranch, byUnit, bySales });
  }

  withTrend(vsLastMonth: ClosingReportTrend): ClosingReportBuilder {
    return new ClosingReportBuilder({ ...this.props, vsLastMonth });
  }

  build(): Result<ClosingReport, ValidationError> {
    return ClosingReport.create(this.props as ClosingReportProps);
  }
}
