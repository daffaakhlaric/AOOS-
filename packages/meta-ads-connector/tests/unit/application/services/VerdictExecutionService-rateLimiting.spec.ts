import { describe, expect, it, vi } from "vitest";

import { VerdictExecutionService } from "../../../../src/application/services/VerdictExecutionService.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";

describe("VerdictExecutionService + a genuinely exhausted TokenBucketRateLimiter", () => {
  it("PAUSE fails fast with no HTTP call at all once the local rate-limit budget is exhausted", async () => {
    const client: IMetaAdsClient = {
      getCampaigns: vi.fn(),
      getAdSets: vi.fn(),
      getAds: vi.fn(),
      pauseAd: vi.fn(),
      scaleAdSetBudget: vi.fn(),
      fixCampaignObjective: vi.fn(),
    };
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 0 });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const service = new VerdictExecutionService(client, rateLimiter, retry);

    const result = await service.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "T",
    });
    expect(result.ok).toBe(false);
    expect(client.pauseAd).not.toHaveBeenCalled();
  });

  it("REFRESH and KEEP never touch the rate limiter at all (no API call to gate)", async () => {
    const client: IMetaAdsClient = {
      getCampaigns: vi.fn(),
      getAdSets: vi.fn(),
      getAds: vi.fn(),
      pauseAd: vi.fn(),
      scaleAdSetBudget: vi.fn(),
      fixCampaignObjective: vi.fn(),
    };
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 0 });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const service = new VerdictExecutionService(client, rateLimiter, retry);

    const refreshResult = await service.execute({
      verdict: Verdict.REFRESH,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "T",
    });
    const keepResult = await service.execute({
      verdict: Verdict.KEEP,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "T",
    });
    expect(refreshResult.ok).toBe(true);
    expect(keepResult.ok).toBe(true);
  });
});
