import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { evaluateNeedCreative } from "./need-creative.js";

describe("evaluateNeedCreative", () => {
  describe("condition (a) — Verdict SCALE/FIX with no NORMAL asset", () => {
    it("triggers for SCALE + confirmed no NORMAL asset", () => {
      const result = evaluateNeedCreative({
        verdict: Verdict.SCALE,
        hasNormalAsset: false,
      });
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain("SCALE");
    });

    it("triggers for FIX + confirmed no NORMAL asset", () => {
      const result = evaluateNeedCreative({
        verdict: Verdict.FIX,
        hasNormalAsset: false,
      });
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain("FIX");
    });

    it("does NOT trigger when a NORMAL asset exists (hasNormalAsset true)", () => {
      const result = evaluateNeedCreative({
        verdict: Verdict.SCALE,
        hasNormalAsset: true,
      });
      expect(result.triggered).toBe(false);
    });

    it("does NOT trigger for an irrelevant verdict (KEEP/PAUSE/REVIEW/REFRESH), even with no NORMAL asset", () => {
      for (const verdict of [Verdict.KEEP, Verdict.PAUSE, Verdict.REVIEW, Verdict.REFRESH]) {
        expect(evaluateNeedCreative({ verdict, hasNormalAsset: false }).triggered).toBe(false);
      }
    });

    it("honestly degrades: does NOT trigger when hasNormalAsset is undefined (no creative_packages row exists yet), even with a SCALE verdict", () => {
      const result = evaluateNeedCreative({ verdict: Verdict.SCALE, hasNormalAsset: undefined });
      expect(result.triggered).toBe(false);
    });

    it("honestly degrades: does NOT trigger when verdict is undefined, even with hasNormalAsset false", () => {
      const result = evaluateNeedCreative({ hasNormalAsset: false });
      expect(result.triggered).toBe(false);
    });
  });

  describe("condition (b) — in-use asset FATIGUED", () => {
    it("triggers when inUseFatigueStatus is FATIGUED", () => {
      const result = evaluateNeedCreative({ inUseFatigueStatus: "FATIGUED" });
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain("FATIGUED");
    });

    it("does NOT trigger for WARNING (only FATIGUED triggers condition b)", () => {
      expect(evaluateNeedCreative({ inUseFatigueStatus: "WARNING" }).triggered).toBe(false);
    });

    it("does NOT trigger for NORMAL", () => {
      expect(evaluateNeedCreative({ inUseFatigueStatus: "NORMAL" }).triggered).toBe(false);
    });

    it("honestly degrades: does NOT trigger when inUseFatigueStatus is undefined", () => {
      expect(evaluateNeedCreative({}).triggered).toBe(false);
    });
  });

  it("triggers on condition (b) even when condition (a)'s inputs are absent", () => {
    const result = evaluateNeedCreative({ inUseFatigueStatus: "FATIGUED" });
    expect(result.triggered).toBe(true);
  });

  it("returns triggered:false with no signals at all (fully honest degrade)", () => {
    expect(evaluateNeedCreative({}).triggered).toBe(false);
  });
});
