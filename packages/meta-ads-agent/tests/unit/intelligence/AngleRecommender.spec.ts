import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { AngleRecommender } from "../../../src/intelligence/AngleRecommender.js";

describe("AngleRecommender", () => {
  it("Xpander + Bintaro -> DP_RINGAN (first priority, pinned business-correctness value)", () => {
    expect(AngleRecommender.recommend(Branch.BINTARO, "Xpander Cross 2019")).toBe(
      AdAngle.DP_RINGAN,
    );
  });

  it("Xpander + Bintaro full ranking matches the spec's exact table", () => {
    expect(AngleRecommender.rank(Branch.BINTARO, "Xpander Cross 2019")).toEqual([
      AdAngle.DP_RINGAN,
      AdAngle.GUDANGNYA,
      AdAngle.QNA,
    ]);
  });

  it("Brio + Bintaro full ranking matches the spec's exact table", () => {
    expect(AngleRecommender.rank(Branch.BINTARO, "Brio Satya 2020")).toEqual([
      AdAngle.DP_RINGAN,
      AdAngle.KREDIT_SYARIAH,
      AdAngle.DISCOVERY,
    ]);
  });

  it("Xpander + Cinere full ranking matches the spec's exact table", () => {
    expect(AngleRecommender.rank(Branch.CINERE, "Xpander Cross 2019")).toEqual([
      AdAngle.GUDANGNYA,
      AdAngle.DP_RINGAN,
      AdAngle.QNA,
    ]);
    expect(AngleRecommender.recommend(Branch.CINERE, "Xpander Cross 2019")).toBe(AdAngle.GUDANGNYA);
  });

  it("defaults to [DP_RINGAN] for a branch/unit combination with no specific data", () => {
    expect(AngleRecommender.rank(Branch.BANDUNG, "Avanza Veloz 2021")).toEqual([AdAngle.DP_RINGAN]);
    expect(AngleRecommender.recommend(Branch.BANDUNG, "Avanza Veloz 2021")).toBe(AdAngle.DP_RINGAN);
  });

  it("defaults to DP_RINGAN for a known branch but unlisted unit", () => {
    expect(AngleRecommender.recommend(Branch.BINTARO, "Raize 2022")).toBe(AdAngle.DP_RINGAN);
  });

  it("unit matching is case-insensitive", () => {
    expect(AngleRecommender.recommend(Branch.BINTARO, "xpander cross")).toBe(AdAngle.DP_RINGAN);
  });

  it("defaults to [DP_RINGAN] when the branch's ranking table exists but has no entry for this unit key", () => {
    // Branch.CINERE's table only lists XPANDER — BRIO is a recognized unit key but absent here.
    expect(AngleRecommender.rank(Branch.CINERE, "Brio Satya 2020")).toEqual([AdAngle.DP_RINGAN]);
  });

  it("defaults to [DP_RINGAN] when the unit matches but the branch has no ranking table at all", () => {
    // Branch.BANDUNG has no ANGLE_RANKING entry, even though "Xpander" IS a recognized unit key.
    expect(AngleRecommender.rank(Branch.BANDUNG, "Xpander Cross 2019")).toEqual([
      AdAngle.DP_RINGAN,
    ]);
  });
});
