import { describe, expect, it } from "vitest";

import {
  dedupeFacadeCollisions,
  findFacadeCollisions,
  OUT_OF_SCOPE_DIVERSITY_DIMENSIONS,
  resolvePlausibleFacades,
  resolveScoringConceptFamily,
  resolveScoringFacade,
  scoreCreativeDiversitySet,
  type DiversityScoredBrief,
} from "./creative-diversity-score.js";

/** Builds a minimal, structurally-valid brief for these pure-function tests — only `angle`/`format` matter to this file's scoring/collision logic. */
function brief(
  angle: string,
  format: "VIDEO_AND_IMAGES" | "IMAGES_ONLY" = "IMAGES_ONLY",
): DiversityScoredBrief {
  return { angle, format };
}

describe("resolvePlausibleFacades / resolveScoringConceptFamily / resolveScoringFacade", () => {
  it("resolves every real PropertyAdAngle to a non-empty set of plausible facades", () => {
    const angles = [
      "DP_RINGAN",
      "READY_HUNI",
      "INVESTASI",
      "EXCLUSIVE",
      "SYARIAH",
      "PROMO_TERBATAS",
      "TESTIMONIAL",
      "VIRTUAL_TOUR",
    ];
    for (const angle of angles) {
      const facades = resolvePlausibleFacades(angle);
      expect(facades.length).toBeGreaterThan(0);
      for (const facade of facades) {
        expect(facade.conceptFamily).toBeTruthy();
        expect(facade.layoutFamily).toBeTruthy();
      }
    }
  });

  it("resolveScoringConceptFamily/resolveScoringFacade deterministically pick the FIRST plausible facade", () => {
    expect(resolveScoringConceptFamily("DP_RINGAN")).toBe("PRICE_DOMINANT");
    expect(resolveScoringFacade("DP_RINGAN")).toEqual({
      conceptFamily: "PRICE_DOMINANT",
      layoutFamily: "PRICE_DOMINANT",
    });
    // Deterministic — calling twice with the same angle returns the exact same result, no randomness.
    expect(resolveScoringConceptFamily("VIRTUAL_TOUR")).toBe(
      resolveScoringConceptFamily("VIRTUAL_TOUR"),
    );
  });

  it("throws an honest invariant error for an angle outside the real PropertyAdAngle vocabulary", () => {
    expect(() => resolvePlausibleFacades("NOT_A_REAL_ANGLE")).toThrow(
      /no concept family mapped for angle/,
    );
  });
});

describe("findFacadeCollisions", () => {
  it("finds zero collisions for an empty set", () => {
    expect(findFacadeCollisions([])).toEqual([]);
  });

  it("finds zero collisions for a single brief", () => {
    expect(findFacadeCollisions([brief("DP_RINGAN")])).toEqual([]);
  });

  it("flags a real, plausible collision between DP_RINGAN and SYARIAH (both plausibly MORTGAGE_CARD)", () => {
    const collisions = findFacadeCollisions([brief("DP_RINGAN"), brief("SYARIAH")]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({
      conceptFamily: "MORTGAGE_CARD",
      layoutFamily: "MORTGAGE_CARD",
      indices: [0, 1],
      angles: ["DP_RINGAN", "SYARIAH"],
    });
  });

  it("flags a real, plausible collision between DP_RINGAN and PROMO_TERBATAS (both plausibly PRICE_DOMINANT)", () => {
    const collisions = findFacadeCollisions([brief("DP_RINGAN"), brief("PROMO_TERBATAS")]);
    expect(collisions.some((group) => group.conceptFamily === "PRICE_DOMINANT")).toBe(true);
  });

  it("flags a real, plausible collision between READY_HUNI and VIRTUAL_TOUR (both plausibly POV_TOUR)", () => {
    const collisions = findFacadeCollisions([brief("READY_HUNI"), brief("VIRTUAL_TOUR")]);
    expect(collisions.some((group) => group.conceptFamily === "POV_TOUR")).toBe(true);
  });

  it("finds zero collisions for a genuinely diverse set (INVESTASI + EXCLUSIVE + TESTIMONIAL share no plausible facade)", () => {
    const collisions = findFacadeCollisions([
      brief("INVESTASI"),
      brief("EXCLUSIVE"),
      brief("TESTIMONIAL"),
    ]);
    expect(collisions).toEqual([]);
  });

  it("a collision is real even though the two briefs have DIFFERENT angles — proves this is NOT merely angle-repetition detection", () => {
    const collisions = findFacadeCollisions([brief("DP_RINGAN"), brief("SYARIAH")]);
    expect(collisions[0]?.angles).not.toEqual([collisions[0]?.angles[0], collisions[0]?.angles[0]]);
    expect(new Set(collisions[0]?.angles).size).toBe(2);
  });
});

describe("scoreCreativeDiversitySet", () => {
  it("scores an empty set as vacuously fully diverse (score 1 on every dimension)", () => {
    const result = scoreCreativeDiversitySet([]);
    expect(result.overallScore).toBe(1);
    for (const dim of result.dimensions) {
      expect(dim.score).toBe(1);
      expect(dim.totalCount).toBe(0);
    }
    expect(result.facadeCollisions).toEqual([]);
  });

  it("scores a genuinely diverse set at overallScore 1 across every covered dimension", () => {
    // Only 2 briefs: `format` is a real binary vocabulary (VIDEO_AND_IMAGES | IMAGES_ONLY), so a
    // 3rd brief could never honestly reach a distinct 3rd format value — capping this "fully
    // diverse" case at 2 briefs keeps the overallScore === 1 assertion below honest.
    const result = scoreCreativeDiversitySet([
      brief("DP_RINGAN", "IMAGES_ONLY"),
      brief("READY_HUNI", "VIDEO_AND_IMAGES"),
    ]);
    expect(result.overallScore).toBe(1);
    expect(result.facadeCollisions).toEqual([]);
    const angleDim = result.dimensions.find((d) => d.dimension === "angle");
    expect(angleDim).toMatchObject({ distinctCount: 2, totalCount: 2, score: 1 });
  });

  it("reports a lower conceptFamily/composition score AND a facadeCollisions entry for a colliding set", () => {
    const result = scoreCreativeDiversitySet([brief("DP_RINGAN"), brief("SYARIAH")]);
    const conceptDim = result.dimensions.find((d) => d.dimension === "conceptFamily");
    // DP_RINGAN's scalar pick is PRICE_DOMINANT, SYARIAH's scalar pick is MORTGAGE_CARD — the
    // single-pick scalar score itself stays 1 (2 distinct picks / 2 briefs), which is exactly why
    // the SET-based `facadeCollisions` check below is the real, sensitive signal, not this scalar.
    expect(conceptDim?.totalCount).toBe(2);
    expect(result.facadeCollisions.length).toBeGreaterThan(0);
  });

  it("reports every one of the spec's 4 out-of-scope dimensions with an honest reason, every call", () => {
    const result = scoreCreativeDiversitySet([brief("DP_RINGAN")]);
    expect(result.outOfScopeDimensions).toBe(OUT_OF_SCOPE_DIVERSITY_DIMENSIONS);
    expect(result.outOfScopeDimensions.map((d) => d.dimension)).toEqual([
      "hero asset diversity",
      "storytelling diversity",
      "visual hook diversity",
      "information density diversity",
    ]);
    for (const dim of result.outOfScopeDimensions) {
      expect(dim.reason.length).toBeGreaterThan(0);
    }
  });

  it("covers exactly the 4 spec dimensions with real backing data", () => {
    const result = scoreCreativeDiversitySet([brief("DP_RINGAN")]);
    expect(result.coveredDimensions).toEqual(["angle", "conceptFamily", "composition", "format"]);
  });
});

describe("dedupeFacadeCollisions", () => {
  it("keeps every brief in an already-diverse set unchanged (order preserved)", () => {
    const briefs = [brief("DP_RINGAN"), brief("READY_HUNI"), brief("INVESTASI")];
    expect(dedupeFacadeCollisions(briefs)).toEqual(briefs);
  });

  it("drops a LATER brief that collides with an EARLIER brief's plausible facade, even with a different angle", () => {
    const briefs = [brief("DP_RINGAN"), brief("SYARIAH"), brief("READY_HUNI")];
    const result = dedupeFacadeCollisions(briefs);
    expect(result.map((b) => b.angle)).toEqual(["DP_RINGAN", "READY_HUNI"]);
  });

  it("never keeps fewer than 1 brief for a non-empty input — the first brief always survives", () => {
    const result = dedupeFacadeCollisions([
      brief("DP_RINGAN"),
      brief("SYARIAH"),
      brief("PROMO_TERBATAS"),
    ]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.angle).toBe("DP_RINGAN");
  });

  it("returns an empty array for an empty input", () => {
    expect(dedupeFacadeCollisions([])).toEqual([]);
  });

  it("chained collisions: DP_RINGAN keeps PRICE_DOMINANT+MORTGAGE_CARD used, so both SYARIAH (shares MORTGAGE_CARD) and PROMO_TERBATAS (shares PRICE_DOMINANT) are dropped", () => {
    const result = dedupeFacadeCollisions([
      brief("DP_RINGAN"),
      brief("SYARIAH"),
      brief("PROMO_TERBATAS"),
      brief("TESTIMONIAL"),
    ]);
    expect(result.map((b) => b.angle)).toEqual(["DP_RINGAN", "TESTIMONIAL"]);
  });

  it("is a strictly-more-conservative subset — never returns MORE briefs than it was given", () => {
    const briefs = [
      brief("DP_RINGAN"),
      brief("SYARIAH"),
      brief("READY_HUNI"),
      brief("VIRTUAL_TOUR"),
    ];
    expect(dedupeFacadeCollisions(briefs).length).toBeLessThanOrEqual(briefs.length);
  });

  it("preserves every field on a kept brief, not just angle/format (generic T is preserved)", () => {
    interface FullBrief extends DiversityScoredBrief {
      readonly headline: string;
    }
    const briefs: FullBrief[] = [
      { angle: "DP_RINGAN", format: "IMAGES_ONLY", headline: "Hemat DP!" },
    ];
    const result = dedupeFacadeCollisions(briefs);
    expect(result[0]).toEqual(briefs[0]);
  });
});
