import { AspectRatio, VideoModel } from "@aos/creative-connector";
import { describe, expect, it } from "vitest";

import type { PropertyCreativeBrief } from "../../../src/contracts/IPropertyPromptBuilder.js";
import { CreativeFormat } from "../../../src/domain/value-objects/CreativeFormat.js";
import { PropertyAdAngle } from "../../../src/domain/value-objects/PropertyAdAngle.js";
import { PropertyFormatDecider } from "../../../src/intelligence/PropertyFormatDecider.js";

function buildBrief(overrides: Partial<PropertyCreativeBrief> = {}): PropertyCreativeBrief {
  return {
    listingId: "listing-1",
    listingTitle: "Rumah Bintaro 88m²",
    propertyType: "RUMAH",
    angle: PropertyAdAngle.READY_HUNI,
    branch: "BINTARO",
    waNumber: "+628123456789",
    ...overrides,
  };
}

describe("PropertyFormatDecider", () => {
  const decider = new PropertyFormatDecider();

  describe("decideFormat()", () => {
    it("VIRTUAL_TOUR + photos >= 1 -> VIDEO_AND_IMAGES (video-appropriate angle)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
    });

    it("VIRTUAL_TOUR + no photos -> IMAGES_ONLY (no source photo)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
      expect(decider.decideFormat(brief, 0)).toBe(CreativeFormat.IMAGES_ONLY);
    });

    it("TESTIMONIAL + photos >= 1 -> VIDEO_AND_IMAGES", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.TESTIMONIAL });
      expect(decider.decideFormat(brief, 1)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
    });

    it("EXCLUSIVE + photos >= 1 -> VIDEO_AND_IMAGES", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.EXCLUSIVE });
      expect(decider.decideFormat(brief, 1)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
    });

    it("PROMO_TERBATAS + photos >= 1 -> VIDEO_AND_IMAGES", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.PROMO_TERBATAS });
      expect(decider.decideFormat(brief, 1)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
    });

    it("DP_RINGAN + photos >= 1 -> IMAGES_ONLY (not a video-appropriate angle)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.DP_RINGAN });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
    });

    it("READY_HUNI + photos >= 1 -> IMAGES_ONLY", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.READY_HUNI });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
    });

    it("INVESTASI + photos >= 1 -> IMAGES_ONLY", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.INVESTASI });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
    });

    it("SYARIAH + photos >= 1 -> IMAGES_ONLY", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.SYARIAH });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
    });
  });

  describe("decideVideoSpec()", () => {
    it("VIRTUAL_TOUR -> durationSeconds 30 (full walkthrough)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
      expect(decider.decideVideoSpec(brief).durationSeconds).toBe(30);
    });

    it("TESTIMONIAL (video-appropriate, not VIRTUAL_TOUR) -> durationSeconds 15", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.TESTIMONIAL });
      expect(decider.decideVideoSpec(brief).durationSeconds).toBe(15);
    });

    it("DP_RINGAN (not video-appropriate) -> durationSeconds falls back to a single 8s clip", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.DP_RINGAN });
      expect(decider.decideVideoSpec(brief).durationSeconds).toBe(8);
    });

    it("PROMO_TERBATAS (HIGH urgency-equivalent) -> model veo3", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.PROMO_TERBATAS });
      expect(decider.decideVideoSpec(brief).model).toBe(VideoModel.VEO3);
    });

    it("VIRTUAL_TOUR (HIGH urgency-equivalent) -> model veo3", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
      expect(decider.decideVideoSpec(brief).model).toBe(VideoModel.VEO3);
    });

    it("TESTIMONIAL (MEDIUM urgency-equivalent) -> model veo3_fast", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.TESTIMONIAL });
      expect(decider.decideVideoSpec(brief).model).toBe(VideoModel.VEO3_FAST);
    });

    it("VIRTUAL_TOUR -> aspectRatio 9:16 (vertical walkthrough)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
      expect(decider.decideVideoSpec(brief).aspectRatio).toBe(AspectRatio.VERTICAL);
    });

    it("TESTIMONIAL -> aspectRatio 16:9 (widescreen, feed default)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.TESTIMONIAL });
      expect(decider.decideVideoSpec(brief).aspectRatio).toBe(AspectRatio.WIDESCREEN);
    });
  });

  describe("decideImageSpec()", () => {
    it("always decides a count of 3", () => {
      const brief = buildBrief();
      expect(decider.decideImageSpec(brief).count).toBe(3);
    });

    it("uses model nano-banana-pro", () => {
      const brief = buildBrief();
      expect(decider.decideImageSpec(brief).model).toBe("nano-banana-pro");
    });

    it("VIRTUAL_TOUR -> aspectRatio 9:16 (vertical)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
      expect(decider.decideImageSpec(brief).aspectRatio).toBe(AspectRatio.VERTICAL);
    });

    it("non-VIRTUAL_TOUR angle -> aspectRatio 1:1 (square feed default)", () => {
      const brief = buildBrief({ angle: PropertyAdAngle.READY_HUNI });
      expect(decider.decideImageSpec(brief).aspectRatio).toBe(AspectRatio.SQUARE);
    });
  });
});
