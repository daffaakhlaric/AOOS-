import type { Result } from "@aos/common";

import type { AdAccount } from "../../domain/entities/AdAccount.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { PullCampaignDataInput, PullCampaignData } from "../use-cases/PullCampaignData.js";

/**
 * Composition-level service orchestrating `PullCampaignData` across one or many ad accounts —
 * the entry point `MetaAdsConnectorFactory` wires up for callers that just want "sync my
 * account(s)" without touching the use case directly. Handles the spec's "Multiple ad accounts
 * in single sync" edge case: each account is synced independently (a failure on one account does
 * not abort the others — the caller gets a `Result` per account).
 */
export class MetaAdsSyncService {
  constructor(private readonly pullCampaignData: PullCampaignData) {}

  async syncAccount(input: PullCampaignDataInput): Promise<Result<AdAccount, MetaApiError>> {
    return this.pullCampaignData.execute(input);
  }

  async syncAccounts(
    inputs: ReadonlyArray<PullCampaignDataInput>,
  ): Promise<ReadonlyArray<Result<AdAccount, MetaApiError>>> {
    const results: Array<Result<AdAccount, MetaApiError>> = [];
    for (const input of inputs) {
      // Sequential, not `Promise.all` — respects the shared `TokenBucketRateLimiter`'s
      // single-threaded token accounting; concurrent bursts would otherwise all read the
      // pre-decrement token count before any of them writes it back.
      results.push(await this.syncAccount(input));
    }
    return results;
  }
}
