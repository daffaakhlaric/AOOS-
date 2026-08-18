import { AspectRatio, VideoModel } from "@aos/creative-connector";
import { describe, expect, it } from "vitest";

import { CreativeFormat } from "../../../src/domain/value-objects/CreativeFormat.js";
import { FormatDecider } from "../../../src/intelligence/FormatDecider.js";
import { buildBrief } from "../../fixtures/creativeBriefFixtures.js";

describe("FormatDecider", () => {
  const decider = new FormatDecider();

  it("VIDEO_15S in formats + photos >= 1 + urgency != LOW -> VIDEO_AND_IMAGES", () => {
    const brief = buildBrief({ formats: ["VIDEO_15S", "IMAGE_SQUARE"], urgency: "HIGH" });
    expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
  });

  it("no photos -> IMAGES_ONLY even with a video format requested", () => {
    const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
    expect(decider.decideFormat(brief, 0)).toBe(CreativeFormat.IMAGES_ONLY);
  });

  it("urgency=LOW -> IMAGES_ONLY even with photos and a video format requested", () => {
    const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "LOW" });
    expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
  });

  it("formats=[IMAGE_SQUARE] -> IMAGES_ONLY (no video format requested)", () => {
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"], urgency: "HIGH" });
    expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
  });

  it("VIDEO_30S also triggers VIDEO_AND_IMAGES under the same conditions", () => {
    const brief = buildBrief({ formats: ["VIDEO_30S"], urgency: "MEDIUM" });
    expect(decider.decideFormat(brief, 1)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
  });

  describe("pinned business-correctness matrix", () => {
    it("formats=['VIDEO_15S'], photos=3, urgency='HIGH' -> VIDEO_AND_IMAGES", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.VIDEO_AND_IMAGES);
    });

    it("formats=['VIDEO_15S'], photos=0, urgency='HIGH' -> IMAGES_ONLY (no source photo)", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
      expect(decider.decideFormat(brief, 0)).toBe(CreativeFormat.IMAGES_ONLY);
    });

    it("formats=['IMAGE_SQUARE'], photos=3, urgency='HIGH' -> IMAGES_ONLY (no video in formats)", () => {
      const brief = buildBrief({ formats: ["IMAGE_SQUARE"], urgency: "HIGH" });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
    });

    it("formats=['VIDEO_15S'], photos=3, urgency='LOW' -> IMAGES_ONLY (low priority)", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "LOW" });
      expect(decider.decideFormat(brief, 3)).toBe(CreativeFormat.IMAGES_ONLY);
    });
  });

  describe("decideVideoSpec()", () => {
    it("VIDEO_30S in formats -> durationSeconds 30", () => {
      const brief = buildBrief({ formats: ["VIDEO_30S"], urgency: "HIGH" });
      expect(decider.decideVideoSpec(brief).durationSeconds).toBe(30);
    });

    it("VIDEO_15S (no VIDEO_30S) -> durationSeconds 15", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
      expect(decider.decideVideoSpec(brief).durationSeconds).toBe(15);
    });

    it("neither VIDEO_15S nor VIDEO_30S -> durationSeconds falls back to a single 8s clip", () => {
      const brief = buildBrief({ formats: ["IMAGE_SQUARE"], urgency: "HIGH" });
      expect(decider.decideVideoSpec(brief).durationSeconds).toBe(8);
    });

    it("HIGH urgency -> model veo3", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
      expect(decider.decideVideoSpec(brief).model).toBe(VideoModel.VEO3);
    });

    it("MEDIUM urgency -> model veo3_fast", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "MEDIUM" });
      expect(decider.decideVideoSpec(brief).model).toBe(VideoModel.VEO3_FAST);
    });

    it("IMAGE_STORY in formats -> aspectRatio 9:16 (vertical)", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S", "IMAGE_STORY"], urgency: "HIGH" });
      expect(decider.decideVideoSpec(brief).aspectRatio).toBe(AspectRatio.VERTICAL);
    });

    it("no IMAGE_STORY -> aspectRatio 16:9 (widescreen, feed default)", () => {
      const brief = buildBrief({ formats: ["VIDEO_15S", "IMAGE_SQUARE"], urgency: "HIGH" });
      expect(decider.decideVideoSpec(brief).aspectRatio).toBe(AspectRatio.WIDESCREEN);
    });
  });

  describe("decideImageSpec()", () => {
    it("always decides a count of 3", () => {
      const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });
      expect(decider.decideImageSpec(brief).count).toBe(3);
    });

    it("uses model nano-banana-pro", () => {
      const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });
      expect(decider.decideImageSpec(brief).model).toBe("nano-banana-pro");
    });

    it("IMAGE_STORY in formats -> aspectRatio 9:16 (vertical)", () => {
      const brief = buildBrief({ formats: ["IMAGE_STORY"] });
      expect(decider.decideImageSpec(brief).aspectRatio).toBe(AspectRatio.VERTICAL);
    });

    it("no IMAGE_STORY -> aspectRatio 1:1 (square feed default)", () => {
      const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });
      expect(decider.decideImageSpec(brief).aspectRatio).toBe(AspectRatio.SQUARE);
    });
  });
});
