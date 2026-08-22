import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { CreateLookalikeAudience } from "../../../../src/application/use-cases/CreateLookalikeAudience.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    createLookalikeAudience: vi.fn().mockResolvedValue(ok({ id: "lookalike-1" })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new CreateLookalikeAudience(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

describe("CreateLookalikeAudience (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
  it("converts percentage (1/2/3) to Meta's real ratio (0.01/0.02/0.03)", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      name: "AAOS-Lookalike-2pct-DSS-Motor",
      originAudienceId: "audience-1",
      percentage: 2,
      country: "ID",
      accessToken: "TOKEN",
    });
    expect(client.createLookalikeAudience).toHaveBeenCalledWith(
      "act_752604553578354",
      {
        name: "AAOS-Lookalike-2pct-DSS-Motor",
        originAudienceId: "audience-1",
        ratio: 0.02,
        country: "ID",
      },
      "TOKEN",
    );
  });

  it("returns { audienceId } on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        adAccountId,
        name: "AAOS-Lookalike-1pct-DSS-Motor",
        originAudienceId: "audience-1",
        percentage: 1,
        country: "ID",
        accessToken: "TOKEN",
      }),
    );
    expect(result).toEqual({ audienceId: "lookalike-1" });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      createLookalikeAudience: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("seed too small", { httpStatus: 400 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      name: "Fails",
      originAudienceId: "audience-1",
      percentage: 3,
      country: "ID",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });
});
