import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { UploadCreativeAsset } from "../../../../src/application/use-cases/UploadCreativeAsset.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    uploadVideo: vi.fn().mockResolvedValue(ok({ id: "video-1" })),
    uploadImage: vi.fn().mockResolvedValue(
      ok({
        images: {
          "https://storage.googleapis.com/aaos/creative.jpg": {
            hash: "hash-abc",
            url: "https://storage.googleapis.com/aaos/creative.jpg",
          },
        },
      }),
    ),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new UploadCreativeAsset(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

describe("UploadCreativeAsset (AAOS-GO-LIVE)", () => {
  it("VIDEO: calls client.uploadVideo and normalizes the response to { assetType: 'VIDEO', assetId }", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        adAccountId,
        assetType: "VIDEO",
        hostedUrl: "https://storage.googleapis.com/aaos/creative.mp4",
        accessToken: "TOKEN",
      }),
    );
    expect(client.uploadVideo).toHaveBeenCalledWith(
      "act_752604553578354",
      "https://storage.googleapis.com/aaos/creative.mp4",
      "TOKEN",
    );
    expect(result).toEqual({ assetType: "VIDEO", assetId: "video-1" });
    expect(client.uploadImage).not.toHaveBeenCalled();
  });

  it("IMAGE: calls client.uploadImage and normalizes the images map's hash to { assetType: 'IMAGE', assetId }", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        adAccountId,
        assetType: "IMAGE",
        hostedUrl: "https://storage.googleapis.com/aaos/creative.jpg",
        accessToken: "TOKEN",
      }),
    );
    expect(client.uploadImage).toHaveBeenCalledWith(
      "act_752604553578354",
      "https://storage.googleapis.com/aaos/creative.jpg",
      "TOKEN",
    );
    expect(result).toEqual({ assetType: "IMAGE", assetId: "hash-abc" });
  });

  it("returns the error when the video upload fails", async () => {
    const client = fakeClient({
      uploadVideo: vi.fn().mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      assetType: "VIDEO",
      hostedUrl: "https://storage.googleapis.com/aaos/creative.mp4",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });

  it("returns the error when the image upload fails", async () => {
    const client = fakeClient({
      uploadImage: vi.fn().mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      assetType: "IMAGE",
      hostedUrl: "https://storage.googleapis.com/aaos/creative.jpg",
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });

  it("returns an ApiServerError when the image upload response's images map is empty", async () => {
    const client = fakeClient({
      uploadImage: vi.fn().mockResolvedValue(ok({ images: {} })),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      assetType: "IMAGE",
      hostedUrl: "https://storage.googleapis.com/aaos/creative.jpg",
      accessToken: "TOKEN",
    });
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });
});
