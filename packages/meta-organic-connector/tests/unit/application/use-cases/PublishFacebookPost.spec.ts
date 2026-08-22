import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { PublishFacebookPost } from "../../../../src/application/use-cases/PublishFacebookPost.js";
import type { IMetaOrganicClient } from "../../../../src/contracts/IMetaOrganicClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaOrganicClient> = {}): IMetaOrganicClient {
  return {
    publishFacebookPost: vi.fn().mockResolvedValue(ok({ id: "page-1_post-1" })),
    ...overrides,
  } as unknown as IMetaOrganicClient;
}

function makeUseCase(client: IMetaOrganicClient): PublishFacebookPost {
  return new PublishFacebookPost(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("PublishFacebookPost (AAOS-SOSMED-AUTOMATION Phase 2)", () => {
  it("calls client.publishFacebookPost with the given pageId/message/link", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      pageId: "page-1",
      message: "Xpander Cross DP 29jt",
      link: "https://mobix.example/xpander",
      accessToken: "TOKEN",
    });
    expect(client.publishFacebookPost).toHaveBeenCalledWith(
      { pageId: "page-1", message: "Xpander Cross DP 29jt", link: "https://mobix.example/xpander" },
      "TOKEN",
    );
  });

  it("returns { postId } on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({ pageId: "page-1", message: "Hello", accessToken: "TOKEN" }),
    );
    expect(result).toEqual({ postId: "page-1_post-1" });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      publishFacebookPost: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      pageId: "page-1",
      message: "Fails",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });
});
