import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { RestructureCampaign } from "../../../../src/application/use-cases/RestructureCampaign.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    pauseAdSet: vi.fn().mockResolvedValue(ok({ success: true })),
    scaleAdSetBudget: vi.fn().mockResolvedValue(ok({ success: true })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new RestructureCampaign(
    client,
    new TokenBucketRateLimiter(),
    // `maxAttempts: 1` — this class's own tests exercise ONE real HTTP call per ad set with a
    // deterministic, pre-queued mock outcome; `ExponentialBackoffRetry`'s default retries a real
    // `ApiServerError` (see `isRetryable`), which would silently consume extra queued
    // `mockResolvedValueOnce` values across attempts instead of across ad sets.
    new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("RestructureCampaign (Samantha Andromeda-Aware Campaign System, Sprint 1)", () => {
  it("pauses every real ad set in adSetIdsToPause via client.pauseAdSet", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);

    const result = await useCase.execute({
      campaignId: "campaign-1",
      adSetIdsToPause: ["adset-a", "adset-b"],
      accessToken: "TOKEN",
    });

    expect(client.pauseAdSet).toHaveBeenCalledWith("adset-a", "TOKEN");
    expect(client.pauseAdSet).toHaveBeenCalledWith("adset-b", "TOKEN");
    expect(result.pausedAdSets).toEqual([
      { adSetId: "adset-a", ok: true },
      { adSetId: "adset-b", ok: true },
    ]);
    expect(result.budgetConsolidation).toBeUndefined();
  });

  it("consolidates budget onto the kept ad set via client.scaleAdSetBudget when consolidateBudget is supplied", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);

    const result = await useCase.execute({
      campaignId: "campaign-1",
      adSetIdsToPause: ["adset-a"],
      consolidateBudget: { adSetId: "adset-keep", newDailyBudgetCents: 500_000 },
      accessToken: "TOKEN",
    });

    expect(client.scaleAdSetBudget).toHaveBeenCalledWith("adset-keep", 500_000, "TOKEN");
    expect(result.budgetConsolidation).toEqual({ adSetId: "adset-keep", ok: true });
  });

  it("BEST-EFFORT: one ad set's pause failing does not stop the others from being attempted, and is reported per-item, not thrown", async () => {
    const client = fakeClient({
      pauseAdSet: vi
        .fn()
        .mockResolvedValueOnce(err(new ApiServerError("boom", { httpStatus: 500 })))
        .mockResolvedValueOnce(ok({ success: true })),
    });
    const useCase = makeUseCase(client);

    const result = await useCase.execute({
      campaignId: "campaign-1",
      adSetIdsToPause: ["adset-fails", "adset-succeeds"],
      accessToken: "TOKEN",
    });

    expect(client.pauseAdSet).toHaveBeenCalledTimes(2);
    expect(result.pausedAdSets).toEqual([
      { adSetId: "adset-fails", ok: false, error: "boom" },
      { adSetId: "adset-succeeds", ok: true },
    ]);
  });

  it("a failed budget consolidation is reported per-item, never thrown, and does not affect the pause results", async () => {
    const client = fakeClient({
      scaleAdSetBudget: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("budget boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);

    const result = await useCase.execute({
      campaignId: "campaign-1",
      adSetIdsToPause: ["adset-a"],
      consolidateBudget: { adSetId: "adset-keep", newDailyBudgetCents: 500_000 },
      accessToken: "TOKEN",
    });

    expect(result.pausedAdSets).toEqual([{ adSetId: "adset-a", ok: true }]);
    expect(result.budgetConsolidation).toEqual({
      adSetId: "adset-keep",
      ok: false,
      error: "budget boom",
    });
  });

  it("never calls the Meta client at all when adSetIdsToPause is empty and no consolidateBudget is given", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);

    const result = await useCase.execute({
      campaignId: "campaign-1",
      adSetIdsToPause: [],
      accessToken: "TOKEN",
    });

    expect(client.pauseAdSet).not.toHaveBeenCalled();
    expect(client.scaleAdSetBudget).not.toHaveBeenCalled();
    expect(result).toEqual({ campaignId: "campaign-1", pausedAdSets: [] });
  });
});
