import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { GetInstagramMediaInsights } from "../../../../src/application/use-cases/GetInstagramMediaInsights.js";
import type { IMetaOrganicClient } from "../../../../src/contracts/IMetaOrganicClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { IG_MEDIA_INSIGHTS_METRICS } from "../../../../src/infrastructure/meta-api/MetaGraphApiRequestBuilder.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

const insightsResponse = {
  data: [{ name: "reach", period: "lifetime", values: [{ value: 842 }] }],
};

function fakeClient(overrides: Partial<IMetaOrganicClient> = {}): IMetaOrganicClient {
  return {
    getInstagramMediaInsights: vi.fn().mockResolvedValue(ok(insightsResponse)),
    ...overrides,
  } as unknown as IMetaOrganicClient;
}

function makeUseCase(client: IMetaOrganicClient): GetInstagramMediaInsights {
  return new GetInstagramMediaInsights(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("GetInstagramMediaInsights (AAOS-SOSMED-AUTOMATION Phase 2)", () => {
  it("calls client.getInstagramMediaInsights with the default metric list when none given", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({ mediaId: "media-1", accessToken: "TOKEN" });
    expect(client.getInstagramMediaInsights).toHaveBeenCalledWith(
      "media-1",
      IG_MEDIA_INSIGHTS_METRICS,
      "TOKEN",
    );
  });

  it("uses a custom metric list when supplied", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({ mediaId: "media-1", accessToken: "TOKEN", metrics: ["reach"] });
    expect(client.getInstagramMediaInsights).toHaveBeenCalledWith("media-1", ["reach"], "TOKEN");
  });

  it("returns the raw MetaInsightsResponse on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(await useCase.execute({ mediaId: "media-1", accessToken: "TOKEN" }));
    expect(result).toEqual(insightsResponse);
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      getInstagramMediaInsights: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({ mediaId: "media-1", accessToken: "TOKEN" });
    expect(result.ok).toBe(false);
  });
});
