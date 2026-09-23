import { describe, expect, it } from "vitest";

import {
  selectRepresentativeCreative,
  type RepresentativeCreativeCandidate,
} from "./representative-creative.js";

/** Real `AdResponseDto`-shaped candidate; every field is a real Meta/Samantha field. */
function candidate(
  overrides: Partial<RepresentativeCreativeCandidate> & { readonly metaAdId: string },
): RepresentativeCreativeCandidate {
  return {
    status: "ACTIVE",
    verdict: "KEEP",
    spend: 0,
    impressions: 0,
    createdAtIso: "2026-09-01T00:00:00.000Z",
    // Real live `meta_ads.creative_ref` shape: an IMAGE hash.
    creativeAsset: { kind: "IMAGE", ref: `hash-${overrides.metaAdId}` },
    abTestWinner: false,
    ...overrides,
  };
}

describe("selectRepresentativeCreative — priority tier 1 (active winning creative)", () => {
  it("prefers a real A/B-test WINNER over a higher-spending active ad", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "big-spender", spend: 9_000_000, impressions: 500_000 }),
      candidate({ metaAdId: "ab-winner", spend: 10, impressions: 5, abTestWinner: true }),
    ]);
    expect(selection?.metaAdId).toBe("ab-winner");
    expect(selection?.priorityTier).toBe(1);
    expect(selection?.badge).toBe("WINNER");
  });

  it("uses Samantha's real SCALE verdict as the winner signal when no A/B-test decision exists", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "plain", spend: 5_000_000 }),
      candidate({ metaAdId: "scaling", spend: 100, verdict: "SCALE" }),
    ]);
    expect(selection?.metaAdId).toBe("scaling");
    expect(selection?.priorityTier).toBe(1);
    expect(selection?.badge).toBe("WINNER");
  });

  it("ignores a winning creative that is NOT active (tier 1 is explicitly 'active winning')", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "paused-winner", status: "PAUSED", abTestWinner: true, spend: 1 }),
      candidate({ metaAdId: "active-spender", spend: 250_000 }),
    ]);
    expect(selection?.metaAdId).toBe("active-spender");
    expect(selection?.priorityTier).toBe(2);
  });

  it("breaks a tie between two active winners by real spend, then impressions", () => {
    const bySpend = selectRepresentativeCreative([
      candidate({ metaAdId: "w-low", verdict: "SCALE", spend: 100, impressions: 10_000 }),
      candidate({ metaAdId: "w-high", verdict: "SCALE", spend: 900, impressions: 1 }),
    ]);
    expect(bySpend?.metaAdId).toBe("w-high");

    const byImpressions = selectRepresentativeCreative([
      candidate({ metaAdId: "w-few", verdict: "SCALE", spend: 500, impressions: 10 }),
      candidate({ metaAdId: "w-many", verdict: "SCALE", spend: 500, impressions: 99_999 }),
    ]);
    expect(byImpressions?.metaAdId).toBe("w-many");
  });
});

describe("selectRepresentativeCreative — priority tier 2 (active, highest spend)", () => {
  it("picks the highest-spending active creative when nothing is winning", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "a", spend: 100_000, impressions: 900_000 }),
      candidate({ metaAdId: "b", spend: 750_000, impressions: 1_000 }),
      candidate({ metaAdId: "c", spend: 400_000, impressions: 50_000 }),
    ]);
    expect(selection?.metaAdId).toBe("b");
    expect(selection?.priorityTier).toBe(2);
    expect(selection?.badge).toBeUndefined();
  });

  it("never counts a paused ad's spend toward tier 2", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "paused-big", status: "PAUSED", spend: 99_000_000 }),
      candidate({ metaAdId: "active-small", spend: 1_000 }),
    ]);
    expect(selection?.metaAdId).toBe("active-small");
    expect(selection?.priorityTier).toBe(2);
  });

  it("skips tier 2 entirely when every active ad has genuinely spent nothing", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "a", spend: 0, impressions: 40 }),
      candidate({ metaAdId: "b", spend: 0, impressions: 900 }),
    ]);
    expect(selection?.priorityTier).toBe(3);
    expect(selection?.metaAdId).toBe("b");
  });

  it("breaks an equal-spend tie by impressions, then by recency", () => {
    const byImpressions = selectRepresentativeCreative([
      candidate({ metaAdId: "s-few", spend: 500_000, impressions: 10 }),
      candidate({ metaAdId: "s-many", spend: 500_000, impressions: 10_000 }),
    ]);
    expect(byImpressions?.metaAdId).toBe("s-many");

    const byRecency = selectRepresentativeCreative([
      candidate({
        metaAdId: "older",
        spend: 500_000,
        impressions: 10,
        createdAtIso: "2026-01-01T00:00:00.000Z",
      }),
      candidate({
        metaAdId: "newer",
        spend: 500_000,
        impressions: 10,
        createdAtIso: "2026-09-01T00:00:00.000Z",
      }),
    ]);
    expect(byRecency?.metaAdId).toBe("newer");
  });

  it("breaks a fully identical tie deterministically by metaAdId (no flickering thumbnail)", () => {
    const shared = { spend: 500_000, impressions: 10, createdAtIso: "2026-05-05T00:00:00.000Z" };
    const first = selectRepresentativeCreative([
      candidate({ metaAdId: "zzz", ...shared }),
      candidate({ metaAdId: "aaa", ...shared }),
    ]);
    const reversed = selectRepresentativeCreative([
      candidate({ metaAdId: "aaa", ...shared }),
      candidate({ metaAdId: "zzz", ...shared }),
    ]);
    expect(first?.metaAdId).toBe("aaa");
    expect(reversed?.metaAdId).toBe("aaa");
  });
});

describe("selectRepresentativeCreative — priority tier 3 (active, highest impressions)", () => {
  it("picks the highest-impressions active creative when no active ad has spent", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "a", impressions: 120 }),
      candidate({ metaAdId: "b", impressions: 12_000 }),
    ]);
    expect(selection?.metaAdId).toBe("b");
    expect(selection?.priorityTier).toBe(3);
  });

  it("skips tier 3 when every active ad has genuinely delivered nothing", () => {
    const selection = selectRepresentativeCreative([
      candidate({
        metaAdId: "no-delivery",
        impressions: 0,
        createdAtIso: "2026-02-02T00:00:00.000Z",
      }),
      candidate({
        metaAdId: "newer-no-delivery",
        impressions: 0,
        createdAtIso: "2026-08-08T00:00:00.000Z",
      }),
    ]);
    expect(selection?.priorityTier).toBe(4);
    expect(selection?.metaAdId).toBe("newer-no-delivery");
  });
});

describe("selectRepresentativeCreative — priority tier 4 (most recently active creative)", () => {
  it("falls back to the newest creative across ALL ads, including paused ones", () => {
    const selection = selectRepresentativeCreative([
      candidate({
        metaAdId: "old-paused",
        status: "PAUSED",
        spend: 5_000_000,
        impressions: 900_000,
        createdAtIso: "2026-01-01T00:00:00.000Z",
      }),
      candidate({
        metaAdId: "recent-paused",
        status: "PAUSED",
        spend: 1_000,
        impressions: 10,
        createdAtIso: "2026-09-15T00:00:00.000Z",
      }),
    ]);
    expect(selection?.metaAdId).toBe("recent-paused");
    expect(selection?.priorityTier).toBe(4);
  });

  it("sorts an unparseable createdAt last rather than treating it as 'now'", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "no-date", status: "ARCHIVED", createdAtIso: "" }),
      candidate({
        metaAdId: "dated",
        status: "ARCHIVED",
        createdAtIso: "2026-03-03T00:00:00.000Z",
      }),
    ]);
    expect(selection?.metaAdId).toBe("dated");
    expect(selection?.priorityTier).toBe(4);
  });
});

describe("selectRepresentativeCreative — tier 5 fallthrough and creative-ref eligibility", () => {
  it("returns undefined when NO ad carries a real Meta creative ref (tier 5: listing, then placeholder)", () => {
    const selection = selectRepresentativeCreative([
      { ...candidate({ metaAdId: "a", spend: 900_000 }), creativeAsset: undefined },
      { ...candidate({ metaAdId: "b" }), creativeAsset: undefined },
    ]);
    expect(selection).toBeUndefined();
  });

  it("returns undefined for an empty campaign", () => {
    expect(selectRepresentativeCreative([])).toBeUndefined();
  });

  it("ignores an ad whose creative ref is an empty string (it can never yield a thumbnail)", () => {
    const selection = selectRepresentativeCreative([
      {
        ...candidate({ metaAdId: "empty-ref", spend: 9_000_000 }),
        creativeAsset: { kind: "IMAGE", ref: "" },
      },
      candidate({ metaAdId: "real-ref", spend: 1 }),
    ]);
    expect(selection?.metaAdId).toBe("real-ref");
  });

  it("carries the real VIDEO id and kind through for a video creative", () => {
    const selection = selectRepresentativeCreative([
      candidate({
        metaAdId: "video-ad",
        spend: 250_000,
        creativeAsset: { kind: "VIDEO", ref: "1523323098869727" },
      }),
    ]);
    expect(selection?.kind).toBe("VIDEO");
    expect(selection?.metaCreativeRef).toBe("1523323098869727");
  });

  it("carries the real IMAGE hash through for an image creative", () => {
    const selection = selectRepresentativeCreative([
      candidate({
        metaAdId: "image-ad",
        spend: 250_000,
        creativeAsset: { kind: "IMAGE", ref: "4b899eb644b9f4649abeea3fe701715c" },
      }),
    ]);
    expect(selection?.kind).toBe("IMAGE");
    expect(selection?.metaCreativeRef).toBe("4b899eb644b9f4649abeea3fe701715c");
  });
});

describe("selectRepresentativeCreative — badge mapping (real fields only)", () => {
  it("maps Samantha's real REFRESH verdict to FATIGUED", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "tired", spend: 400_000, verdict: "REFRESH" }),
    ]);
    expect(selection?.badge).toBe("FATIGUED");
  });

  it.each(["KEEP", "REVIEW", "FIX", "PAUSE"])(
    "renders NO badge for the real but non-winner/non-fatigue verdict %s",
    (verdict) => {
      const selection = selectRepresentativeCreative([
        candidate({ metaAdId: "plain", spend: 400_000, verdict }),
      ]);
      expect(selection?.badge).toBeUndefined();
    },
  );

  it("describes the SELECTED creative, not some other ad in the campaign", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "fatigued-but-not-picked", spend: 10, verdict: "REFRESH" }),
      candidate({ metaAdId: "picked", spend: 900_000, verdict: "KEEP" }),
    ]);
    expect(selection?.metaAdId).toBe("picked");
    expect(selection?.badge).toBeUndefined();
  });

  it("prefers WINNER over FATIGUED if both signals somehow collide", () => {
    const selection = selectRepresentativeCreative([
      candidate({ metaAdId: "both", spend: 400_000, verdict: "REFRESH", abTestWinner: true }),
    ]);
    expect(selection?.badge).toBe("WINNER");
  });
});
