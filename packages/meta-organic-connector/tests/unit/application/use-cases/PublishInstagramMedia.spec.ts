import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { PublishInstagramMedia } from "../../../../src/application/use-cases/PublishInstagramMedia.js";
import type { IMetaOrganicClient } from "../../../../src/contracts/IMetaOrganicClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaOrganicClient> = {}): IMetaOrganicClient {
  return {
    createInstagramMediaContainer: vi.fn().mockResolvedValue(ok({ id: "container-1" })),
    publishInstagramMedia: vi.fn().mockResolvedValue(ok({ id: "media-1" })),
    ...overrides,
  } as unknown as IMetaOrganicClient;
}

function makeUseCase(client: IMetaOrganicClient): PublishInstagramMedia {
  return new PublishInstagramMedia(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

describe("PublishInstagramMedia (AAOS-SOSMED-AUTOMATION Phase 2)", () => {
  it("creates a container, then publishes it with the returned creation_id", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      igUserId: "ig-1",
      media: { kind: "IMAGE", imageUrl: "https://gcs.example/unit.jpg" },
      caption: "Xpander Cross DP 29jt",
      accessToken: "TOKEN",
    });
    expect(client.createInstagramMediaContainer).toHaveBeenCalledWith(
      {
        igUserId: "ig-1",
        media: { kind: "IMAGE", imageUrl: "https://gcs.example/unit.jpg" },
        caption: "Xpander Cross DP 29jt",
      },
      "TOKEN",
    );
    expect(client.publishInstagramMedia).toHaveBeenCalledWith(
      { igUserId: "ig-1", creationId: "container-1" },
      "TOKEN",
    );
  });

  it("returns { mediaId } (the published id, not the container id) on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        igUserId: "ig-1",
        media: { kind: "IMAGE", imageUrl: "https://gcs.example/unit.jpg" },
        accessToken: "TOKEN",
      }),
    );
    expect(result).toEqual({ mediaId: "media-1" });
  });

  it("returns the error and does NOT call publishInstagramMedia when container creation fails", async () => {
    const client = fakeClient({
      createInstagramMediaContainer: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      igUserId: "ig-1",
      media: { kind: "IMAGE", imageUrl: "https://gcs.example/unit.jpg" },
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
    expect(client.publishInstagramMedia).not.toHaveBeenCalled();
  });

  it("returns the error when publish (step 2) fails after a successful container creation", async () => {
    const client = fakeClient({
      publishInstagramMedia: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      igUserId: "ig-1",
      media: { kind: "IMAGE", imageUrl: "https://gcs.example/unit.jpg" },
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
    expect(client.createInstagramMediaContainer).toHaveBeenCalledTimes(1);
  });

  it("supports a VIDEO/REELS/STORIES media spec end-to-end", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      igUserId: "ig-1",
      media: { kind: "REELS", videoUrl: "https://gcs.example/unit.mp4" },
      accessToken: "TOKEN",
    });
    expect(client.createInstagramMediaContainer).toHaveBeenCalledWith(
      {
        igUserId: "ig-1",
        media: { kind: "REELS", videoUrl: "https://gcs.example/unit.mp4" },
        caption: undefined,
      },
      "TOKEN",
    );
  });
});
