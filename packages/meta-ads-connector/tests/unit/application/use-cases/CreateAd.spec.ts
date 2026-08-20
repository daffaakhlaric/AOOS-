import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { CreateAd } from "../../../../src/application/use-cases/CreateAd.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    createAd: vi.fn().mockResolvedValue(ok({ id: "new-ad-1" })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  return new CreateAd(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

describe("CreateAd (AAOS-GO-LIVE)", () => {
  it("calls client.createAd with adSetId/name/pageId/creative and defaults status to ACTIVE", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      adSetId: "adset-1",
      name: "Go Live Ad",
      pageId: "page-1",
      creative: {
        kind: "IMAGE",
        imageHash: "hash-abc",
        linkUrl: "https://wa.me/6281234567890",
        message: "Promo!",
        callToActionType: "WHATSAPP_MESSAGE",
      },
      accessToken: "TOKEN",
    });
    expect(client.createAd).toHaveBeenCalledWith(
      "act_752604553578354",
      {
        adSetId: "adset-1",
        name: "Go Live Ad",
        pageId: "page-1",
        creative: {
          kind: "IMAGE",
          imageHash: "hash-abc",
          linkUrl: "https://wa.me/6281234567890",
          message: "Promo!",
          callToActionType: "WHATSAPP_MESSAGE",
        },
        status: "ACTIVE",
      },
      "TOKEN",
    );
  });

  it("honors a caller-supplied status override instead of the ACTIVE default", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      adSetId: "adset-1",
      name: "Paused Ad",
      pageId: "page-1",
      creative: {
        kind: "VIDEO",
        videoId: "video-1",
        thumbnailUrl: "https://storage.googleapis.com/aaos/thumb.jpg",
        message: "Promo!",
        callToActionType: "WHATSAPP_MESSAGE",
      },
      accessToken: "TOKEN",
      status: "PAUSED",
    });
    expect(client.createAd).toHaveBeenCalledWith(
      "act_752604553578354",
      expect.objectContaining({ status: "PAUSED" }),
      "TOKEN",
    );
  });

  it("returns { adId } on success", async () => {
    const client = fakeClient();
    const useCase = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        adAccountId,
        adSetId: "adset-1",
        name: "Go Live Ad",
        pageId: "page-1",
        creative: {
          kind: "IMAGE",
          imageHash: "hash-abc",
          linkUrl: "https://wa.me/6281234567890",
          message: "Promo!",
          callToActionType: "WHATSAPP_MESSAGE",
        },
        accessToken: "TOKEN",
      }),
    );
    expect(result).toEqual({ adId: "new-ad-1" });
  });

  it("returns the error when the client call fails", async () => {
    const client = fakeClient({
      createAd: vi.fn().mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const useCase = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      adSetId: "adset-1",
      name: "Fails",
      pageId: "page-1",
      creative: {
        kind: "IMAGE",
        imageHash: "hash-abc",
        linkUrl: "https://wa.me/6281234567890",
        message: "Promo!",
        callToActionType: "WHATSAPP_MESSAGE",
      },
      accessToken: "TOKEN",
    });
    expect(result.ok).toBe(false);
  });
});
