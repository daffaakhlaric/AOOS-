import { describe, expect, it } from "vitest";

import type { PropertyCreativeBrief } from "../../../src/contracts/IPropertyPromptBuilder.js";
import { PropertyAdAngle } from "../../../src/domain/value-objects/PropertyAdAngle.js";
import { VideoStoryboardBeatName } from "../../../src/domain/value-objects/VideoStoryboard.js";
import { PropertyVideoStoryboardBuilder } from "../../../src/intelligence/PropertyVideoStoryboardBuilder.js";

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

describe("PropertyVideoStoryboardBuilder", () => {
  const builder = new PropertyVideoStoryboardBuilder();

  describe("buildStoryboard", () => {
    it("produces exactly 5 beats in the spec's real declared order", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 15, true);
      expect(storyboard.scenes).toHaveLength(5);
      expect(storyboard.scenes.map((s) => s.beat)).toEqual([
        VideoStoryboardBeatName.HOOK,
        VideoStoryboardBeatName.PROPERTY_REVEAL,
        VideoStoryboardBeatName.BENEFIT,
        VideoStoryboardBeatName.PROOF,
        VideoStoryboardBeatName.CTA,
      ]);
    });

    it("15s duration -> matches the spec's real literal beat timings exactly (0-2/2-5/5-9/9-12/12-15)", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 15, true);
      const ranges = storyboard.scenes.map((s) => [s.startSec, s.endSec]);
      expect(ranges).toEqual([
        [0, 2],
        [2, 5],
        [5, 9],
        [9, 12],
        [12, 15],
      ]);
    });

    it("8s duration -> real proportional split, contiguous, sums exactly to 8", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 8, true);
      expect(storyboard.durationSeconds).toBe(8);
      expect(storyboard.scenes[0].startSec).toBe(0);
      expect(storyboard.scenes[storyboard.scenes.length - 1].endSec).toBe(8);
      for (let i = 1; i < storyboard.scenes.length; i += 1) {
        expect(storyboard.scenes[i].startSec).toBe(storyboard.scenes[i - 1].endSec);
      }
    });

    it("30s duration -> real proportional split, contiguous, sums exactly to 30", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 30, true);
      expect(storyboard.durationSeconds).toBe(30);
      expect(storyboard.scenes[0].startSec).toBe(0);
      expect(storyboard.scenes[storyboard.scenes.length - 1].endSec).toBe(30);
      for (let i = 1; i < storyboard.scenes.length; i += 1) {
        expect(storyboard.scenes[i].startSec).toBe(storyboard.scenes[i - 1].endSec);
      }
    });

    it("scene numbers are 1-based, per the spec's own JSON sample", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 15, true);
      expect(storyboard.scenes.map((s) => s.scene)).toEqual([1, 2, 3, 4, 5]);
    });

    it("assetId is always '' — no real per-scene asset-selection infrastructure exists", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 15, true);
      for (const scene of storyboard.scenes) {
        expect(scene.assetId).toBe("");
      }
    });

    it("every scene carries non-empty shot/motion/overlay/voiceOver/transition guidance", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 15, true);
      for (const scene of storyboard.scenes) {
        expect(scene.shot.length).toBeGreaterThan(0);
        expect(scene.motion.length).toBeGreaterThan(0);
        expect(scene.overlay.length).toBeGreaterThan(0);
        expect(scene.voiceOver.length).toBeGreaterThan(0);
        expect(scene.transition.length).toBeGreaterThan(0);
      }
    });

    it("voiceOver fields are honestly labeled as planning-only — never claim real TTS", () => {
      const storyboard = builder.buildStoryboard(buildBrief(), 15, true);
      for (const scene of storyboard.scenes) {
        expect(scene.voiceOver).toContain("no real TTS synthesis yet");
      }
    });

    it("DP_RINGAN angle -> benefit beat reflects the angle-specific style", () => {
      const storyboard = builder.buildStoryboard(
        buildBrief({ angle: PropertyAdAngle.DP_RINGAN }),
        15,
        true,
      );
      const benefit = storyboard.scenes.find((s) => s.beat === VideoStoryboardBeatName.BENEFIT);
      expect(benefit?.shot).toContain("affordable down payment");
    });

    it("highlights present -> benefit beat's shot/overlay reflect verified-quality framing", () => {
      const storyboard = builder.buildStoryboard(
        buildBrief({ highlights: ["Dekat sekolah dan tol"] }),
        15,
        true,
      );
      const benefit = storyboard.scenes.find((s) => s.beat === VideoStoryboardBeatName.BENEFIT);
      expect(benefit?.shot).toContain("emphasizing verified quality and buyer confidence");
      expect(benefit?.overlay).not.toContain("Dekat sekolah");
    });

    it("angleReasoning present -> proof beat reflects the data-backed strength clause, never the raw Indonesian text", () => {
      const storyboard = builder.buildStoryboard(
        buildBrief({ angleReasoning: "Harga Rp400.000.000 — semakin terjangkau." }),
        15,
        true,
      );
      const proof = storyboard.scenes.find((s) => s.beat === VideoStoryboardBeatName.PROOF);
      expect(proof?.shot).toContain("grounded in a specific, data-backed property strength");
      expect(proof?.shot).not.toContain("Harga Rp400.000.000");
    });

    it("CONCEPTUAL propertyType (e.g. TANAH) -> hook/reveal beats never claim an existing finished building", () => {
      const storyboard = builder.buildStoryboard(
        buildBrief({ propertyType: "TANAH", listingTitle: "Tanah Kavling Sentul" }),
        15,
        true,
      );
      const hook = storyboard.scenes.find((s) => s.beat === VideoStoryboardBeatName.HOOK);
      const reveal = storyboard.scenes.find(
        (s) => s.beat === VideoStoryboardBeatName.PROPERTY_REVEAL,
      );
      expect(hook?.shot).toContain("conceptual framing");
      expect(reveal?.shot).toContain("not a photograph of an existing finished building");
    });

    it("STRICT propertyType (e.g. RUMAH) -> reveal beat uses the real-photo listing description, no conceptual framing", () => {
      const storyboard = builder.buildStoryboard(buildBrief({ propertyType: "RUMAH" }), 15, true);
      const reveal = storyboard.scenes.find(
        (s) => s.beat === VideoStoryboardBeatName.PROPERTY_REVEAL,
      );
      expect(reveal?.shot).not.toContain("conceptual");
      expect(reveal?.shot).toContain("Rumah Bintaro 88m² (rumah)");
    });

    it("waNumber present vs absent -> CTA overlay reflects it honestly", () => {
      const withWa = builder.buildStoryboard(buildBrief({ waNumber: "+62812" }), 15, true);
      const withoutWa = builder.buildStoryboard(buildBrief({ waNumber: undefined }), 15, true);
      const ctaWith = withWa.scenes.find((s) => s.beat === VideoStoryboardBeatName.CTA);
      const ctaWithout = withoutWa.scenes.find((s) => s.beat === VideoStoryboardBeatName.CTA);
      expect(ctaWith?.overlay).toContain("WhatsApp");
      expect(ctaWithout?.overlay).not.toContain("WhatsApp");
    });
  });

  describe("serializeToPrompt", () => {
    it("produces one single prompt string containing all 5 beat labels and their real timings", () => {
      const brief = buildBrief();
      const storyboard = builder.buildStoryboard(brief, 15, true);
      const prompt = builder.serializeToPrompt(storyboard, brief, true);
      expect(typeof prompt).toBe("string");
      expect(prompt).toContain("0-2s (Hook)");
      expect(prompt).toContain("2-5s (Property reveal)");
      expect(prompt).toContain("5-9s (Benefit)");
      expect(prompt).toContain("9-12s (Proof)");
      expect(prompt).toContain("12-15s (CTA)");
    });

    it("never includes overlay/voiceOver planning text in the serialized prompt (not renderable by Kie AI today)", () => {
      const brief = buildBrief();
      const storyboard = builder.buildStoryboard(brief, 15, true);
      const prompt = builder.serializeToPrompt(storyboard, brief, true);
      expect(prompt).not.toContain("Planning note");
      expect(prompt).not.toContain("no real TTS synthesis yet");
    });

    it("still ends with the real 'no text overlay' generation directive", () => {
      const brief = buildBrief();
      const storyboard = builder.buildStoryboard(brief, 15, true);
      const prompt = builder.serializeToPrompt(storyboard, brief, true);
      expect(prompt).toContain("no text overlay");
    });

    it("sourcePhotoAvailable=false appends the text-only generation note", () => {
      const brief = buildBrief();
      const storyboard = builder.buildStoryboard(brief, 15, false);
      const prompt = builder.serializeToPrompt(storyboard, brief, false);
      expect(prompt).toContain("generated from text description only");
    });

    it("CONCEPTUAL propertyType -> serialized prompt uses the conceptual framing, never the STRICT one", () => {
      const brief = buildBrief({ propertyType: "TANAH", listingTitle: "Tanah Kavling Sentul" });
      const storyboard = builder.buildStoryboard(brief, 15, true);
      const prompt = builder.serializeToPrompt(storyboard, brief, true);
      expect(prompt).not.toContain("Professional real estate advertisement video structured");
      expect(prompt).toContain("Conceptual architectural visualization video");
      expect(prompt).toContain("NOT a video of an existing finished building");
    });

    it("STRICT propertyType -> serialized prompt uses the real-photo advertisement framing", () => {
      const brief = buildBrief({ propertyType: "RUMAH" });
      const storyboard = builder.buildStoryboard(brief, 15, true);
      const prompt = builder.serializeToPrompt(storyboard, brief, true);
      expect(prompt).toContain(
        "Professional real estate advertisement video structured as a 5-beat storyboard",
      );
    });

    it("output is a single string (honest: one real Kie AI prompt call, never multiple)", () => {
      const brief = buildBrief();
      const storyboard = builder.buildStoryboard(brief, 15, true);
      const prompt = builder.serializeToPrompt(storyboard, brief, true);
      expect(prompt.split("\n")).toHaveLength(1);
    });
  });
});
