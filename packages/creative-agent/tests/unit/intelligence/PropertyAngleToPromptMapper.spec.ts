import { describe, expect, it } from "vitest";

import {
  ALL_PROPERTY_AD_ANGLES,
  PropertyAdAngle,
} from "../../../src/domain/value-objects/PropertyAdAngle.js";
import { PropertyAngleToPromptMapper } from "../../../src/intelligence/PropertyAngleToPromptMapper.js";

const INDONESIAN_MARKERS = [" yang ", " dengan ", " dan ", "kami", "kak "];

describe("PropertyAngleToPromptMapper", () => {
  it("all 8 PropertyAdAngle members map to a non-empty English prompt style", () => {
    expect(ALL_PROPERTY_AD_ANGLES).toHaveLength(8);
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const style = PropertyAngleToPromptMapper.styleFor(angle);
      expect(style.length).toBeGreaterThan(0);
    }
  });

  it("no Indonesian text in any mapped style", () => {
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const style = PropertyAngleToPromptMapper.styleFor(angle);
      for (const marker of INDONESIAN_MARKERS) {
        expect(style.toLowerCase()).not.toContain(marker);
      }
    }
  });

  it("DP_RINGAN maps to a style mentioning affordable down payment", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.DP_RINGAN)).toContain(
      "affordable down payment",
    );
  });

  it("READY_HUNI maps to a style mentioning move-in ready", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.READY_HUNI)).toContain(
      "move-in ready",
    );
  });

  it("INVESTASI maps to a style mentioning smart investment", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.INVESTASI)).toContain(
      "smart investment",
    );
  });

  it("EXCLUSIVE maps to a style mentioning premium/luxury", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.EXCLUSIVE)).toContain("luxury");
  });

  it("SYARIAH maps to a style mentioning Islamic finance", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.SYARIAH)).toContain(
      "Islamic finance",
    );
  });

  it("PROMO_TERBATAS maps to a style mentioning limited-time urgency", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.PROMO_TERBATAS)).toContain(
      "limited-time",
    );
  });

  it("TESTIMONIAL maps to a style mentioning a happy homeowner", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.TESTIMONIAL)).toContain(
      "happy homeowner",
    );
  });

  it("VIRTUAL_TOUR maps to a style mentioning an immersive walkthrough", () => {
    expect(PropertyAngleToPromptMapper.styleFor(PropertyAdAngle.VIRTUAL_TOUR)).toContain(
      "immersive walkthrough",
    );
  });
});
