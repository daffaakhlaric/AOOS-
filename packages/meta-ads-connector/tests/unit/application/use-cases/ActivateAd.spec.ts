import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { ActivateAd } from "../../../../src/application/use-cases/ActivateAd.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    activateAd: vi.fn().mockResolvedValue(ok({ success: true })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new ActivateAd(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("ActivateAd (AAOS-GO-LIVE)", () => {
  it("calls client.activateAd with the adId and accessToken", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({ adId: "ad-1", accessToken: "TOKEN" });
    expect(client.activateAd).toHaveBeenCalledWith("ad-1", "TOKEN");
  });

  it("returns { adId, status: 'ACTIVE' } on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = await useCase.execute({ adId: "ad-1", accessToken: "TOKEN" });
    expect(result).toEqual({ ok: true, value: { adId: "ad-1", status: "ACTIVE" } });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      activateAd: vi.fn().mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({ adId: "ad-1", accessToken: "TOKEN" });
    expect(result.ok).toBe(false);
  });
});
