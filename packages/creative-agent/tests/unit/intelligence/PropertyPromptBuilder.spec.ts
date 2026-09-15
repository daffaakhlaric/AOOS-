import { describe, expect, it } from "vitest";

import type { PropertyCreativeBrief } from "../../../src/contracts/IPropertyPromptBuilder.js";
import {
  PropertyAdAngle,
  ALL_PROPERTY_AD_ANGLES,
} from "../../../src/domain/value-objects/PropertyAdAngle.js";
import { PropertyPromptBuilder } from "../../../src/intelligence/PropertyPromptBuilder.js";

const INDONESIAN_MARKERS = ["yang", "dengan", "dan", "untuk", "kak", "juta", "murah", "keluarga"];

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

describe("PropertyPromptBuilder", () => {
  const builder = new PropertyPromptBuilder();

  it("DP_RINGAN angle -> video prompt includes 'affordable down payment'", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.DP_RINGAN });
    expect(builder.buildVideoPrompt(brief, true)).toContain("affordable down payment");
  });

  it("SYARIAH angle -> video prompt includes 'Islamic finance'", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.SYARIAH });
    expect(builder.buildVideoPrompt(brief, true)).toContain("Islamic finance");
  });

  it("VIRTUAL_TOUR angle -> video prompt includes 'immersive walkthrough'", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.VIRTUAL_TOUR });
    expect(builder.buildVideoPrompt(brief, true)).toContain("immersive walkthrough");
  });

  it("all 8 angles produce English-only video prompts (no Indonesian words)", () => {
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const brief = buildBrief({ angle });
      const prompt = builder.buildVideoPrompt(brief, true).toLowerCase();
      for (const marker of INDONESIAN_MARKERS) {
        expect(prompt).not.toMatch(new RegExp(`\\b${marker}\\b`));
      }
    }
  });

  it("all 8 angles produce English-only image prompts (no Indonesian words)", () => {
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const brief = buildBrief({ angle });
      const prompt = builder.buildImagePrompt(brief, 0, false).toLowerCase();
      for (const marker of INDONESIAN_MARKERS) {
        expect(prompt).not.toMatch(new RegExp(`\\b${marker}\\b`));
      }
    }
  });

  it("listing title + property type are included in the video prompt", () => {
    const brief = buildBrief({ listingTitle: "Apartemen Cinere View", propertyType: "APARTEMEN" });
    expect(builder.buildVideoPrompt(brief, true)).toContain("Apartemen Cinere View (apartemen)");
  });

  it("listing title is included in the image prompt", () => {
    const brief = buildBrief({ listingTitle: "Rumah Bintaro 88m²" });
    expect(builder.buildImagePrompt(brief, 0, false)).toContain("Rumah Bintaro 88m²");
  });

  it("sourcePhotoAvailable=false appends a text-only generation note to the video prompt", () => {
    const brief = buildBrief();
    expect(builder.buildVideoPrompt(brief, false)).toContain(
      "generated from text description only",
    );
  });

  it("sourcePhotoAvailable=true omits the text-only generation note", () => {
    const brief = buildBrief();
    expect(builder.buildVideoPrompt(brief, true)).not.toContain(
      "generated from text description only",
    );
  });

  it("image prompt variant index is reflected as a 1-based 'variant N'", () => {
    const brief = buildBrief();
    expect(builder.buildImagePrompt(brief, 0, false)).toContain("variant 1");
    expect(builder.buildImagePrompt(brief, 2, false)).toContain("variant 3");
  });

  it("highlights presence adds a generic English trust clause, never the raw Indonesian text", () => {
    const brief = buildBrief({ highlights: ["Dekat sekolah dan tol"] });
    const prompt = builder.buildVideoPrompt(brief, true);
    expect(prompt).toContain("emphasizing verified quality and buyer confidence");
    expect(prompt).not.toContain("Dekat sekolah");
  });

  it("no highlights -> no trust clause added", () => {
    const brief = buildBrief({ highlights: undefined });
    expect(builder.buildVideoPrompt(brief, true)).not.toContain("emphasizing verified quality");
  });

  it("empty highlights array behaves the same as undefined", () => {
    const brief = buildBrief({ highlights: [] });
    expect(builder.buildVideoPrompt(brief, true)).not.toContain("emphasizing verified quality");
  });

  it("image prompt also gets the highlights trust clause when present", () => {
    const brief = buildBrief({ highlights: ["Bebas banjir"] });
    expect(builder.buildImagePrompt(brief, 0, false)).toContain(
      "emphasizing verified quality and buyer confidence",
    );
  });

  // Kai Creative Engine Sprint 3 — real angle-strength reasoning (scorePropertyAdAngleStrength)
  // nudges the prompt with an English clause; its Indonesian VALUE is never interpolated raw, same
  // discipline `highlights` already establishes above.
  it("angleReasoning present -> prompt includes the data-backed strength clause, never the raw Indonesian reasoning text", () => {
    const brief = buildBrief({
      angleReasoning: "Harga Rp400.000.000 — semakin terjangkau, semakin kuat angle DP ringan.",
    });
    const videoPrompt = builder.buildVideoPrompt(brief, true);
    const imagePrompt = builder.buildImagePrompt(brief, 0, false);
    expect(videoPrompt).toContain("grounded in a specific, data-backed property strength");
    expect(imagePrompt).toContain("grounded in a specific, data-backed property strength");
    expect(videoPrompt).not.toContain("Harga Rp400.000.000");
    expect(imagePrompt).not.toContain("Harga Rp400.000.000");
  });

  it("no angleReasoning -> no data-backed strength clause added", () => {
    const brief = buildBrief({ angleReasoning: undefined });
    expect(builder.buildVideoPrompt(brief, true)).not.toContain(
      "grounded in a specific, data-backed property strength",
    );
  });

  // REAL BUG FIX (live-confirmed, 2026-09-15): the real reference photo (image_input) WAS
  // reaching Kie AI, but the prompt never told the model to actually base its output on it — Kai
  // generated a completely unrelated scene every time despite a real photo being attached. This
  // anchoring clause is the fix; these tests guard it stays wired to the real sourcePhotoAvailable
  // signal, never fabricated when generation is honestly text-only.
  it("sourcePhotoAvailable=true anchors the image prompt to the real attached reference photo", () => {
    const brief = buildBrief();
    expect(builder.buildImagePrompt(brief, 0, true)).toContain(
      "Using the attached reference photo as the exact base scene",
    );
  });

  it("sourcePhotoAvailable=false omits the anchoring clause — never fabricated when generation is honestly text-only", () => {
    const brief = buildBrief();
    expect(builder.buildImagePrompt(brief, 0, false)).not.toContain(
      "Using the attached reference photo",
    );
  });
});
