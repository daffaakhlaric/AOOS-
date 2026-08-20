import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { PauseCampaign } from "../../../../src/application/use-cases/PauseCampaign.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    pauseCampaign: vi.fn().mockResolvedValue(ok({ success: true })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new PauseCampaign(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("PauseCampaign (AAOS-GO-LIVE)", () => {
  it("calls client.pauseCampaign with the campaignId and accessToken", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({ campaignId: "campaign-1", accessToken: "TOKEN" });
    expect(client.pauseCampaign).toHaveBeenCalledWith("campaign-1", "TOKEN");
  });

  it("returns { campaignId, status: 'PAUSED' } on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = await useCase.execute({ campaignId: "campaign-1", accessToken: "TOKEN" });
    expect(result).toEqual({ ok: true, value: { campaignId: "campaign-1", status: "PAUSED" } });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      pauseCampaign: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({ campaignId: "campaign-1", accessToken: "TOKEN" });
    expect(result.ok).toBe(false);
  });
});
