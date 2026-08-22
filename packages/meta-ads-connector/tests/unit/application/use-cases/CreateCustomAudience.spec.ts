import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { CreateCustomAudience } from "../../../../src/application/use-cases/CreateCustomAudience.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    createCustomAudience: vi.fn().mockResolvedValue(ok({ id: "audience-1" })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new CreateCustomAudience(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

describe("CreateCustomAudience (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
  it("calls client.createCustomAudience with subtype CUSTOM and a default USER_PROVIDED_ONLY source", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      name: "AAOS-HotLeads-DSS-Motor-Aug26",
      description: "Hot leads dari AAOS Jessy AI (score >= 65)",
      accessToken: "TOKEN",
    });
    expect(client.createCustomAudience).toHaveBeenCalledWith(
      "act_752604553578354",
      {
        name: "AAOS-HotLeads-DSS-Motor-Aug26",
        subtype: "CUSTOM",
        description: "Hot leads dari AAOS Jessy AI (score >= 65)",
        customerFileSource: "USER_PROVIDED_ONLY",
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
        name: "AAOS-HotLeads-DSS-Motor-Aug26",
        accessToken: "TOKEN",
      }),
    );
    expect(result).toEqual({ audienceId: "audience-1" });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      createCustomAudience: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      name: "Fails",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });
});
