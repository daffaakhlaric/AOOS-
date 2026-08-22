import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { AddUsersToCustomAudience } from "../../../../src/application/use-cases/AddUsersToCustomAudience.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { hashPhoneForAudience } from "../../../../src/utils/PhoneHasher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    addUsersToCustomAudience: vi
      .fn()
      .mockResolvedValue(ok({ session_id: 1, num_received: 2, num_invalid_entries: 0 })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new AddUsersToCustomAudience(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("AddUsersToCustomAudience (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
  it("normalizes and SHA256-hashes phone numbers before calling the client", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      customAudienceId: "audience-1",
      phones: ["+6281234567890", "081234567891"],
      accessToken: "TOKEN",
    });
    expect(client.addUsersToCustomAudience).toHaveBeenCalledWith(
      "audience-1",
      {
        hashedPhones: [
          hashPhoneForAudience("+6281234567890"),
          hashPhoneForAudience("081234567891"),
        ],
      },
      "TOKEN",
    );
  });

  it("filters out phone numbers that normalize to empty before hashing", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      customAudienceId: "audience-1",
      phones: ["+6281234567890", "not-a-phone-###"],
      accessToken: "TOKEN",
    });
    expect(client.addUsersToCustomAudience).toHaveBeenCalledWith(
      "audience-1",
      { hashedPhones: [hashPhoneForAudience("+6281234567890")] },
      "TOKEN",
    );
  });

  it("returns an err Result without calling the client when every phone number is invalid", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      customAudienceId: "audience-1",
      phones: ["###", ""],
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
    expect(client.addUsersToCustomAudience).not.toHaveBeenCalled();
  });

  it("returns { numReceived, numInvalidEntries } on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        customAudienceId: "audience-1",
        phones: ["+6281234567890"],
        accessToken: "TOKEN",
      }),
    );
    expect(result).toEqual({ numReceived: 2, numInvalidEntries: 0 });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      addUsersToCustomAudience: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      customAudienceId: "audience-1",
      phones: ["+6281234567890"],
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });
});
