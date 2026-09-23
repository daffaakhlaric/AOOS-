import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import {
  MAX_VIDEO_THUMBNAIL_CALLS,
  ResolveCreativeThumbnails,
} from "../../../../src/application/use-cases/ResolveCreativeThumbnails.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError, RateLimitError } from "../../../../src/domain/errors/index.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

/** Real image hash + real video ids, copied from live `meta_ads.creative_ref` rows on tenant `agen-pintar-indonesia`. */
const REAL_IMAGE_HASH = "4b899eb644b9f4649abeea3fe701715c";
const REAL_VIDEO_ID = "1523323098869727";
const REAL_VIDEO_ID_2 = "1777935213340727";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    getAdImagesByHashes: vi.fn().mockResolvedValue(
      ok({
        data: [
          {
            hash: REAL_IMAGE_HASH,
            url: "https://scontent.xx.fbcdn.net/v/real-image.jpg",
            permalink_url: "https://www.facebook.com/ads/image/?d=REAL",
          },
        ],
      }),
    ),
    getVideoThumbnail: vi.fn().mockResolvedValue(
      ok({
        id: REAL_VIDEO_ID,
        picture: "https://scontent.xx.fbcdn.net/v/auto-picture.jpg",
        thumbnails: {
          data: [
            { uri: "https://scontent.xx.fbcdn.net/v/frame-0.jpg", is_preferred: false },
            { uri: "https://scontent.xx.fbcdn.net/v/frame-preferred.jpg", is_preferred: true },
          ],
        },
      }),
    ),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(
  client: IMetaAdsClient,
  rateLimiter = new TokenBucketRateLimiter(),
): ResolveCreativeThumbnails {
  return new ResolveCreativeThumbnails(
    client,
    rateLimiter,
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    createMockLogger() as never,
    createFakeTracer(),
  );
}

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
const accessToken = "TOKEN";

describe("ResolveCreativeThumbnails (AAOS Command Center creative thumbnails)", () => {
  it("resolves a real image hash to Meta's own `url` via ONE batched adimages call", async () => {
    const client = fakeClient();
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [REAL_IMAGE_HASH],
      videoIds: [],
      accessToken,
    });

    expect(client.getAdImagesByHashes).toHaveBeenCalledTimes(1);
    expect(client.getAdImagesByHashes).toHaveBeenCalledWith(
      "act_752604553578354",
      [REAL_IMAGE_HASH],
      accessToken,
    );
    expect(output.thumbnailUrlsByRef.get(REAL_IMAGE_HASH)).toBe(
      "https://scontent.xx.fbcdn.net/v/real-image.jpg",
    );
    expect(output.unresolvedImageHashes).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it("BATCHES every hash into exactly ONE call, never one call per hash (the real rate-limit guarantee)", async () => {
    const hashes = ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8"];
    const client = fakeClient({
      getAdImagesByHashes: vi
        .fn()
        .mockResolvedValue(
          ok({ data: hashes.map((hash) => ({ hash, url: `https://cdn.example/${hash}.jpg` })) }),
        ),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: hashes,
      videoIds: [],
      accessToken,
    });

    expect(client.getAdImagesByHashes).toHaveBeenCalledTimes(1);
    expect(client.getAdImagesByHashes).toHaveBeenCalledWith(
      "act_752604553578354",
      hashes,
      accessToken,
    );
    expect(output.thumbnailUrlsByRef.size).toBe(8);
  });

  it("deduplicates repeated refs before spending a call on them", async () => {
    const client = fakeClient();
    await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [REAL_IMAGE_HASH, REAL_IMAGE_HASH, "", REAL_IMAGE_HASH],
      videoIds: [REAL_VIDEO_ID, REAL_VIDEO_ID],
      accessToken,
    });

    expect(client.getAdImagesByHashes).toHaveBeenCalledWith(
      "act_752604553578354",
      [REAL_IMAGE_HASH],
      accessToken,
    );
    expect(client.getVideoThumbnail).toHaveBeenCalledTimes(1);
  });

  it("falls back to Meta's stable `permalink_url` when a real row carries no CDN `url`", async () => {
    const client = fakeClient({
      getAdImagesByHashes: vi.fn().mockResolvedValue(
        ok({
          data: [
            { hash: REAL_IMAGE_HASH, permalink_url: "https://www.facebook.com/ads/image/?d=REAL" },
          ],
        }),
      ),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [REAL_IMAGE_HASH],
      videoIds: [],
      accessToken,
    });
    expect(output.thumbnailUrlsByRef.get(REAL_IMAGE_HASH)).toBe(
      "https://www.facebook.com/ads/image/?d=REAL",
    );
  });

  it("reports a hash Meta silently omitted as unresolved, never mapping it to another asset's URL", async () => {
    const client = fakeClient({
      getAdImagesByHashes: vi
        .fn()
        .mockResolvedValue(
          ok({ data: [{ hash: REAL_IMAGE_HASH, url: "https://cdn.example/real.jpg" }] }),
        ),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [REAL_IMAGE_HASH, "deleted-from-library-hash"],
      videoIds: [],
      accessToken,
    });
    expect(output.unresolvedImageHashes).toEqual(["deleted-from-library-hash"]);
    expect(output.thumbnailUrlsByRef.has("deleted-from-library-hash")).toBe(false);
  });

  it("prefers the Ads-Manager-selected (`is_preferred`) poster frame for a video creative", async () => {
    const client = fakeClient();
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds: [REAL_VIDEO_ID],
      accessToken,
    });
    expect(client.getVideoThumbnail).toHaveBeenCalledWith(REAL_VIDEO_ID, accessToken);
    expect(output.thumbnailUrlsByRef.get(REAL_VIDEO_ID)).toBe(
      "https://scontent.xx.fbcdn.net/v/frame-preferred.jpg",
    );
  });

  it("falls back to the video's own auto-selected `picture` when no frame is preferred", async () => {
    const client = fakeClient({
      getVideoThumbnail: vi.fn().mockResolvedValue(
        ok({
          id: REAL_VIDEO_ID,
          picture: "https://scontent.xx.fbcdn.net/v/auto-picture.jpg",
          thumbnails: { data: [{ uri: "https://scontent.xx.fbcdn.net/v/frame-0.jpg" }] },
        }),
      ),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds: [REAL_VIDEO_ID],
      accessToken,
    });
    expect(output.thumbnailUrlsByRef.get(REAL_VIDEO_ID)).toBe(
      "https://scontent.xx.fbcdn.net/v/auto-picture.jpg",
    );
  });

  it("leaves a still-processing video (no `picture`, no `thumbnails`) unresolved rather than fabricating one", async () => {
    const client = fakeClient({
      getVideoThumbnail: vi.fn().mockResolvedValue(ok({ id: REAL_VIDEO_ID })),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds: [REAL_VIDEO_ID],
      accessToken,
    });
    expect(output.thumbnailUrlsByRef.size).toBe(0);
    expect(output.unresolvedVideoIds).toEqual([REAL_VIDEO_ID]);
    expect(output.errors).toEqual([]);
  });

  it("spends ZERO Meta calls when both ref lists are empty", async () => {
    const client = fakeClient();
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds: [],
      accessToken,
    });
    expect(client.getAdImagesByHashes).not.toHaveBeenCalled();
    expect(client.getVideoThumbnail).not.toHaveBeenCalled();
    expect(output.thumbnailUrlsByRef.size).toBe(0);
  });

  it("caps video calls at MAX_VIDEO_THUMBNAIL_CALLS and reports the skipped ids honestly", async () => {
    const videoIds = Array.from(
      { length: MAX_VIDEO_THUMBNAIL_CALLS + 3 },
      (_, i) => `v${String(i)}`,
    );
    const client = fakeClient({
      getVideoThumbnail: vi
        .fn()
        .mockImplementation(async (videoId: string) =>
          ok({ id: videoId, picture: `https://cdn.example/${videoId}.jpg` }),
        ),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds,
      accessToken,
    });

    expect(client.getVideoThumbnail).toHaveBeenCalledTimes(MAX_VIDEO_THUMBNAIL_CALLS);
    expect(output.unresolvedVideoIds).toEqual(videoIds.slice(MAX_VIDEO_THUMBNAIL_CALLS));
    expect(output.errors[0]).toContain("MAX_VIDEO_THUMBNAIL_CALLS");
  });

  it("degrades honestly (never throws, never err) when the batched adimages call fails", async () => {
    const client = fakeClient({
      getAdImagesByHashes: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("Meta API request failed with HTTP 500"))),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [REAL_IMAGE_HASH],
      videoIds: [],
      accessToken,
    });
    expect(output.thumbnailUrlsByRef.size).toBe(0);
    expect(output.unresolvedImageHashes).toEqual([REAL_IMAGE_HASH]);
    expect(output.errors[0]).toContain("HTTP 500");
  });

  it("keeps resolving the remaining videos when one video's own call fails", async () => {
    const client = fakeClient({
      // Keyed by video id (not call order) — `ExponentialBackoffRetry` legitimately re-invokes the
      // failing operation, so a `mockImplementationOnce` chain would run dry mid-retry.
      getVideoThumbnail: vi
        .fn()
        .mockImplementation(async (videoId: string) =>
          videoId === REAL_VIDEO_ID
            ? err(new ApiServerError("Meta API request failed with HTTP 500"))
            : ok({ id: videoId, picture: "https://cdn.example/v2.jpg" }),
        ),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds: [REAL_VIDEO_ID, REAL_VIDEO_ID_2],
      accessToken,
    });
    expect(output.thumbnailUrlsByRef.get(REAL_VIDEO_ID_2)).toBe("https://cdn.example/v2.jpg");
    expect(output.unresolvedVideoIds).toEqual([REAL_VIDEO_ID]);
    expect(output.errors[0]).toContain("HTTP 500");
  });

  /**
   * A REAL Meta 429/code-17 feeds `retryAfterMs` back into the shared `TokenBucketRateLimiter`
   * (`callMetaApi` -> `notifyRateLimited`), which correctly puts the whole connector into cooldown —
   * so the remaining video ids stop spending calls instead of hammering an already-throttled API.
   * Asserted explicitly because it is the exact protection the live Command Center incident needed.
   */
  it("stops spending calls for the remaining videos once Meta itself reports a real rate limit", async () => {
    const client = fakeClient({
      getVideoThumbnail: vi
        .fn()
        .mockResolvedValue(err(new RateLimitError("User request limit reached", 60_000))),
    });
    const output = await makeUseCase(client).execute({
      adAccountId,
      imageHashes: [],
      videoIds: [REAL_VIDEO_ID, REAL_VIDEO_ID_2],
      accessToken,
    });
    expect(output.thumbnailUrlsByRef.size).toBe(0);
    expect(output.unresolvedVideoIds).toEqual([REAL_VIDEO_ID, REAL_VIDEO_ID_2]);
    expect(output.errors.length).toBe(2);
  });

  it("degrades honestly when the local 200/hour rate-limit budget is already exhausted (no network call at all)", async () => {
    const exhausted = new TokenBucketRateLimiter({ capacity: 0 });
    const client = fakeClient();
    const output = await makeUseCase(client, exhausted).execute({
      adAccountId,
      imageHashes: [REAL_IMAGE_HASH],
      videoIds: [REAL_VIDEO_ID],
      accessToken,
    });
    expect(client.getAdImagesByHashes).not.toHaveBeenCalled();
    expect(client.getVideoThumbnail).not.toHaveBeenCalled();
    expect(output.thumbnailUrlsByRef.size).toBe(0);
    expect(output.unresolvedImageHashes).toEqual([REAL_IMAGE_HASH]);
    expect(output.unresolvedVideoIds).toEqual([REAL_VIDEO_ID]);
    expect(output.errors.length).toBe(2);
  });
});
