import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../../src/builders/AdBuilder.js";
import type { Ad } from "../../../../src/domain/entities/Ad.js";
import {
  LOW_DIVERSITY_RATIO_THRESHOLD,
  MIN_ADS_FOR_DIVERSITY_SCORE,
  scoreCreativeDiversity,
} from "../../../../src/domain/services/CreativeDiversityScoring.js";

function buildAd(overrides: { creativeAsset?: Ad["creativeAsset"] } = {}): Ad {
  const result = new AdBuilder().withCreativeAsset(overrides.creativeAsset).build();
  if (!result.ok) {
    throw new Error(`AdBuilder failed: ${result.error.message}`);
  }
  return result.value;
}

describe("scoreCreativeDiversity", () => {
  it(`NOT_ENOUGH_DATA — fewer than ${String(MIN_ADS_FOR_DIVERSITY_SCORE)} ads, never fabricates a score`, () => {
    const ads = [
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-1" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-2" } }),
    ];
    const result = scoreCreativeDiversity(ads);
    expect(result.status).toBe("NOT_ENOUGH_DATA");
    expect(result.totalAdCount).toBe(2);
    expect(result.distinctCreativeAssetCount).toBeUndefined();
  });

  it("NOT_ENOUGH_DATA — enough ads, but none carry a real creativeAsset (honest degrade, not a fabricated 0)", () => {
    const ads = [buildAd(), buildAd(), buildAd(), buildAd()];
    const result = scoreCreativeDiversity(ads);
    expect(result.status).toBe("NOT_ENOUGH_DATA");
    expect(result.distinctCreativeAssetCount).toBeUndefined();
  });

  it("LOW_DIVERSITY — many ads reuse the exact same real creativeAsset (literal same-asset dedup)", () => {
    const ads = [
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "same-hash" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "same-hash" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "same-hash" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "different-hash" } }),
    ];
    // distinct = 2, total = 4, ratio = 0.5 <= LOW_DIVERSITY_RATIO_THRESHOLD (0.5)
    const result = scoreCreativeDiversity(ads);
    expect(result.status).toBe("LOW_DIVERSITY");
    expect(result.totalAdCount).toBe(4);
    expect(result.distinctCreativeAssetCount).toBe(2);
  });

  it("DIVERSE — most ads carry a distinct real creativeAsset (image or video, deduped correctly)", () => {
    const ads = [
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-1" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-2" } }),
      buildAd({ creativeAsset: { kind: "VIDEO", videoId: "video-1" } }),
      buildAd({ creativeAsset: { kind: "VIDEO", videoId: "video-2" } }),
    ];
    const result = scoreCreativeDiversity(ads);
    expect(result.status).toBe("DIVERSE");
    expect(result.distinctCreativeAssetCount).toBe(4);
    expect(result.totalAdCount).toBe(4);
  });

  it(`ratio exactly at ${String(LOW_DIVERSITY_RATIO_THRESHOLD)} is LOW_DIVERSITY (threshold is inclusive)`, () => {
    const ads = [
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-a" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-a" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-b" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "hash-b" } }),
    ];
    const result = scoreCreativeDiversity(ads);
    expect(result.status).toBe("LOW_DIVERSITY");
  });

  it("an image and a video with the same underlying id string are NOT deduped together (kind-discriminated key)", () => {
    const ads = [
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "x" } }),
      buildAd({ creativeAsset: { kind: "VIDEO", videoId: "x" } }),
      buildAd({ creativeAsset: { kind: "IMAGE", imageHash: "y" } }),
    ];
    const result = scoreCreativeDiversity(ads);
    expect(result.distinctCreativeAssetCount).toBe(3);
  });
});
