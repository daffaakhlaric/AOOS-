import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { VerdictExecutionService } from "../../../../src/application/services/VerdictExecutionService.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    getCampaigns: vi.fn(),
    getAdSets: vi.fn(),
    getAds: vi.fn(),
    pauseAd: vi.fn().mockResolvedValue(ok({ success: true })),
    scaleAdSetBudget: vi.fn().mockResolvedValue(ok({ success: true })),
    fixCampaignObjective: vi.fn().mockResolvedValue(ok({ success: true })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeService(client: IMetaAdsClient) {
  return new VerdictExecutionService(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
  );
}

describe("VerdictExecutionService", () => {
  it("PAUSE calls client.pauseAd and returns action PAUSED", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.PAUSE,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
      }),
    );
    expect(result.action).toBe("PAUSED");
    expect(client.pauseAd).toHaveBeenCalledWith("ad-1", "TOKEN");
  });

  it("SCALE calls client.scaleAdSetBudget with +20% of the current budget, converted to cents", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.SCALE,
        targetId: "adset-1",
        targetType: "adset",
        accessToken: "TOKEN",
        currentDailyBudgetIDR: 100_000,
      }),
    );
    expect(result.action).toBe("SCALED");
    expect(result.previousValue).toBe(100_000);
    expect(result.newValue).toBe(120_000);
    expect(client.scaleAdSetBudget).toHaveBeenCalledWith("adset-1", 12_000_000, "TOKEN");
  });

  it("SCALE defaults currentDailyBudgetIDR to 0 when not provided", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.SCALE,
        targetId: "adset-1",
        targetType: "adset",
        accessToken: "TOKEN",
      }),
    );
    expect(result.newValue).toBe(0);
  });

  it("FIX calls client.fixCampaignObjective with OUTCOME_ENGAGEMENT", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.FIX,
        targetId: "campaign-1",
        targetType: "campaign",
        accessToken: "TOKEN",
      }),
    );
    expect(result.action).toBe("FIXED");
    expect(result.newValue).toBe("OUTCOME_ENGAGEMENT");
    expect(client.fixCampaignObjective).toHaveBeenCalledWith(
      "campaign-1",
      "OUTCOME_ENGAGEMENT",
      "TOKEN",
    );
  });

  it("REFRESH makes no API call and returns HUMAN_ACTION_REQUIRED", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.REFRESH,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
      }),
    );
    expect(result.action).toBe("HUMAN_ACTION_REQUIRED");
    expect(client.pauseAd).not.toHaveBeenCalled();
    expect(client.scaleAdSetBudget).not.toHaveBeenCalled();
    expect(client.fixCampaignObjective).not.toHaveBeenCalled();
  });

  it("KEEP makes no API call and returns NO_ACTION", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.KEEP,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
      }),
    );
    expect(result.action).toBe("NO_ACTION");
    expect(client.pauseAd).not.toHaveBeenCalled();
  });

  it("REVIEW makes no API call and returns NO_ACTION", async () => {
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: Verdict.REVIEW,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
      }),
    );
    expect(result.action).toBe("NO_ACTION");
  });

  it("propagates a client failure for PAUSE", async () => {
    const client = fakeClient({
      pauseAd: vi.fn().mockResolvedValue(err(new ApiServerError("fail", { httpStatus: 500 }))),
    });
    const service = makeService(client);
    const result = await service.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });

  it("propagates a client failure for SCALE", async () => {
    const client = fakeClient({
      scaleAdSetBudget: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("fail", { httpStatus: 500 }))),
    });
    const service = makeService(client);
    const result = await service.execute({
      verdict: Verdict.SCALE,
      targetId: "adset-1",
      targetType: "adset",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });

  it("falls back to NO_ACTION for an unrecognized verdict value (fail-closed default case)", async () => {
    // `Verdict` is a closed enum in practice, but the switch's `default` branch is real defensive
    // code guarding against a value that bypassed the type system (e.g. deserialized from an
    // external source) — exercised here via an explicit unsafe cast.
    const client = fakeClient();
    const service = makeService(client);
    const result = unwrap(
      await service.execute({
        verdict: "BOGUS_VERDICT" as unknown as Verdict,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
      }),
    );
    expect(result.action).toBe("NO_ACTION");
    expect(client.pauseAd).not.toHaveBeenCalled();
  });

  it("propagates a client failure for FIX", async () => {
    const client = fakeClient({
      fixCampaignObjective: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("fail", { httpStatus: 500 }))),
    });
    const service = makeService(client);
    const result = await service.execute({
      verdict: Verdict.FIX,
      targetId: "campaign-1",
      targetType: "campaign",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });
});
