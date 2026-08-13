import { AdAngle } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import { AngleToPromptMapper } from "../../../src/intelligence/AngleToPromptMapper.js";

const INDONESIAN_MARKERS = [" yang ", " dengan ", " dan ", "kami", "kak "];

describe("AngleToPromptMapper", () => {
  it("all 7 AdAngle members map to a non-empty English prompt style (COORDINATOR NOTE #5: was 6 in the spec's illustration, real AdAngle has 7)", () => {
    const angles = Object.values(AdAngle);
    expect(angles).toHaveLength(7);
    for (const angle of angles) {
      const style = AngleToPromptMapper.styleFor(angle);
      expect(style.length).toBeGreaterThan(0);
    }
  });

  it("no Indonesian text in any mapped style", () => {
    for (const angle of Object.values(AdAngle)) {
      const style = AngleToPromptMapper.styleFor(angle);
      for (const marker of INDONESIAN_MARKERS) {
        expect(style.toLowerCase()).not.toContain(marker);
      }
    }
  });

  it("DP_RINGAN maps to a style mentioning affordable financing", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.DP_RINGAN)).toContain("affordable financing");
  });

  it("KREDIT_SYARIAH maps to a style mentioning Islamic finance", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.KREDIT_SYARIAH)).toContain("Islamic finance");
  });

  it("GUDANGNYA maps to a style mentioning large selection", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.GUDANGNYA)).toContain("large selection");
  });

  it("QNA maps to a style mentioning educational/trustworthy framing", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.QNA)).toContain("educational");
  });

  it("DISCOVERY maps to a style mentioning comparison", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.DISCOVERY)).toContain("comparison");
  });

  it("TESTIMONIAL maps to a style mentioning a happy customer", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.TESTIMONIAL)).toContain("happy customer");
  });

  it("WEBSITE_REDIRECT (the 7th, coordinator-note-added angle) maps to a direct-response style", () => {
    expect(AngleToPromptMapper.styleFor(AdAngle.WEBSITE_REDIRECT)).toContain(
      "click-through intent",
    );
  });
});
