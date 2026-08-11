import type { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { IClosingRepository } from "../../contracts/IClosingRepository.js";
import type { ISpendProvider } from "../../contracts/ISpendProvider.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { ClosingStats } from "../../types/LeadStoreTypes.js";

export interface GetClosingStatsInput {
  readonly campaignId?: string;
  readonly adId?: string;
  readonly branchId?: BranchId;
  readonly fromDate: Date;
  readonly toDate: Date;
}

/**
 * Called by Tamara for feed-back optimization. Design resolution #3: `rphSpkByCampaign[campaignId]
 * = spend / closingsCount`, where `spend` comes from the injected `ISpendProvider`
 * (`@aos/meta-ads-connector` in production) and `closingsCount` comes from this package's own
 * `closings` table. Only campaigns with at least 1 closing in the filtered window appear in
 * `rphSpkByCampaign` — the divide-by-zero guard is structural (the denominator is always a count
 * of closings actually found, never 0), so no `NaN`/`Infinity` can ever be produced.
 */
export class GetClosingStats {
  constructor(
    private readonly closingRepository: IClosingRepository,
    private readonly spendProvider: ISpendProvider,
  ) {}

  async execute(input: GetClosingStatsInput): Promise<Result<ClosingStats, LeadStoreError>> {
    if (input.fromDate > input.toDate) {
      return err(
        new LeadStoreError("GetClosingStats: fromDate must not be after toDate", {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const closingsResult = await this.closingRepository.findByFilter({
      campaignId: input.campaignId,
      adId: input.adId,
      branchId: input.branchId,
      fromDate: input.fromDate,
      toDate: input.toDate,
    });
    if (!closingsResult.ok) {
      return err(closingsResult.error);
    }
    const closings = closingsResult.value;

    const totalClosings = closings.length;
    const totalCommissionIdr = closings.reduce(
      (sum, closing) => sum + (closing.commissionIdr ?? 0),
      0,
    );
    const avgCommissionIdr = totalClosings > 0 ? totalCommissionIdr / totalClosings : 0;

    const closingsByCampaign: Record<string, number> = {};
    const closingsByBranch: Record<string, number> = {};
    for (const closing of closings) {
      if (closing.campaignId !== undefined) {
        closingsByCampaign[closing.campaignId] = (closingsByCampaign[closing.campaignId] ?? 0) + 1;
      }
      closingsByBranch[closing.branchId] = (closingsByBranch[closing.branchId] ?? 0) + 1;
    }

    const campaignIds = Object.keys(closingsByCampaign);
    const spendByCampaign = await this.spendProvider.getSpendByCampaign(campaignIds);

    const rphSpkByCampaign: Record<string, number> = {};
    for (const campaignId of campaignIds) {
      const count = closingsByCampaign[campaignId];
      /* v8 ignore next 3 -- campaignIds is derived from Object.keys(closingsByCampaign), so every
         count here is always defined and >=1 by construction; kept as an explicit guard so the
         divide-by-zero rule (design resolution #3) holds even if that invariant ever changes. */
      if (count === undefined || count === 0) {
        continue;
      }
      const spend = spendByCampaign.get(campaignId) ?? 0;
      rphSpkByCampaign[campaignId] = spend / count;
    }

    return ok({
      totalClosings,
      totalCommissionIdr,
      avgCommissionIdr,
      closingsByCampaign,
      rphSpkByCampaign,
      closingsByBranch,
    });
  }
}
