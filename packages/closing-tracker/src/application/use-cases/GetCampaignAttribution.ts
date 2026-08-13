import { err, ok, type Result } from "@aos/common";

import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import type { CampaignAttribution } from "../../domain/entities/CampaignAttribution.js";
import type { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

export interface GetCampaignAttributionInput {
  readonly period: ReportPeriod;
  /** When provided, narrows the result to a single campaign; `undefined` returns every campaign attributed in the period. */
  readonly campaignId?: string;
}

/** Which campaign(s) drove closings in a period (spec: "GetCampaignAttribution ← which campaign drove closings"). Reuses `IReportGenerator` rather than re-running the attribution engine directly, so results are always consistent with `GenerateClosingReport`'s own `campaignAttributions`. */
export class GetCampaignAttribution {
  constructor(private readonly reportGenerator: IReportGenerator) {}

  async execute(
    input: GetCampaignAttributionInput,
  ): Promise<Result<ReadonlyArray<CampaignAttribution>, ClosingTrackerError>> {
    const result = await this.reportGenerator.generate(input.period);
    if (!result.ok) {
      return err(result.error);
    }
    const all = result.value.campaignAttributions;
    if (input.campaignId === undefined) {
      return ok(all);
    }
    return ok(all.filter((a) => a.campaignId === input.campaignId));
  }
}
