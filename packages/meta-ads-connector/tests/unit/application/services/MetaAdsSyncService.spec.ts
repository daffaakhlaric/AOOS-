import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { MetaAdsSyncService } from "../../../../src/application/services/MetaAdsSyncService.js";
import type {
  PullCampaignData,
  PullCampaignDataInput,
} from "../../../../src/application/use-cases/PullCampaignData.js";
import type { AdAccount } from "../../../../src/domain/entities/AdAccount.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { unwrap } from "../../../helpers/result.js";

function fakeInput(adAccountId: string): PullCampaignDataInput {
  return {
    adAccountId: unwrap(AdAccountId.create(adAccountId)),
    datePreset: "last_30d",
    accessToken: "TOKEN",
    tenantId: "tenant-1",
    correlationId: "corr-1",
  };
}

describe("MetaAdsSyncService", () => {
  it("syncAccount delegates to PullCampaignData.execute", async () => {
    const execute = vi.fn().mockResolvedValue(ok("account" as unknown as AdAccount));
    const pullCampaignData = { execute } as unknown as PullCampaignData;
    const service = new MetaAdsSyncService(pullCampaignData);
    const result = await service.syncAccount(fakeInput("act_1"));
    expect(result).toEqual(ok("account"));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("syncAccounts syncs each account sequentially and returns a Result per account", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(ok("account-1" as unknown as AdAccount))
      .mockResolvedValueOnce(err(new ApiServerError("account 2 failed")));
    const pullCampaignData = { execute } as unknown as PullCampaignData;
    const service = new MetaAdsSyncService(pullCampaignData);

    const results = await service.syncAccounts([fakeInput("act_1"), fakeInput("act_2")]);
    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
  });

  it("syncAccounts calls execute once per input, in order", async () => {
    const calls: string[] = [];
    const execute = vi.fn().mockImplementation(async (input: PullCampaignDataInput) => {
      calls.push(input.adAccountId.toString());
      return ok("x" as unknown as AdAccount);
    });
    const pullCampaignData = { execute } as unknown as PullCampaignData;
    const service = new MetaAdsSyncService(pullCampaignData);
    await service.syncAccounts([fakeInput("act_1"), fakeInput("act_2"), fakeInput("act_3")]);
    expect(calls).toEqual(["act_1", "act_2", "act_3"]);
  });

  it("syncAccounts returns an empty array for an empty input list", async () => {
    const execute = vi.fn();
    const pullCampaignData = { execute } as unknown as PullCampaignData;
    const service = new MetaAdsSyncService(pullCampaignData);
    expect(await service.syncAccounts([])).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});
