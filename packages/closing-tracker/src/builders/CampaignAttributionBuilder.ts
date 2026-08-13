import type { BranchId } from "@aos/branch-manager";
import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import {
  CampaignAttribution,
  type CampaignAttributionProps,
  type ClosingVerdict,
} from "../domain/entities/CampaignAttribution.js";
import type { AttributionScore, ClosingRate, RphSpk } from "../domain/value-objects/index.js";

/** Fluent builder for `CampaignAttribution` (spec: "Builder Pattern"). Every setter returns a new builder instance — never mutates in place. */
export class CampaignAttributionBuilder {
  private constructor(private readonly props: Partial<CampaignAttributionProps>) {}

  static create(): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({});
  }

  withCampaignId(campaignId: string): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, campaignId });
  }

  withCampaignName(campaignName: string): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, campaignName });
  }

  withStableId(stableId: string): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, stableId });
  }

  withAdId(adId: string | undefined): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, adId });
  }

  withBranch(branch: BranchId): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, branch });
  }

  withSpendAndLeads(totalSpend: number, totalHotLeads: number): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, totalSpend, totalHotLeads });
  }

  withPipelineCounts(totalTestDrives: number, totalSpk: number): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, totalTestDrives, totalSpk });
  }

  withCommission(totalCommissionIdr: number): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, totalCommissionIdr });
  }

  withKpis(rphSpk: RphSpk, rphLead: number, closingRate: ClosingRate): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, rphSpk, rphLead, closingRate });
  }

  withAttributionScore(attributionScore: AttributionScore): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, attributionScore });
  }

  withVerdict(verdict: ClosingVerdict): CampaignAttributionBuilder {
    return new CampaignAttributionBuilder({ ...this.props, verdict });
  }

  build(): Result<CampaignAttribution, ValidationError> {
    return CampaignAttribution.create(this.props as CampaignAttributionProps);
  }
}
