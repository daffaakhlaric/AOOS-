import { AdAngle } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AutomotivePromptBuilder } from "../../../src/intelligence/AutomotivePromptBuilder.js";
import { buildBrief } from "../../fixtures/creativeBriefFixtures.js";

// A conservative Indonesian-word denylist — any of these appearing in a Kie AI prompt would be a
// real bug (the invariant `PromptQuality.spec.ts` also exercises end-to-end).
const INDONESIAN_MARKERS = ["yang", "dengan", "dan", "untuk", "kak", "juta", "murah", "keluarga"];

describe("AutomotivePromptBuilder", () => {
  const builder = new AutomotivePromptBuilder();

  it("DP_RINGAN angle -> video prompt includes 'affordable financing'", () => {
    const brief = buildBrief({ angle: AdAngle.DP_RINGAN });
    expect(builder.buildVideoPrompt(brief, true)).toContain("affordable financing");
  });

  it("KREDIT_SYARIAH -> video prompt includes 'Islamic finance'", () => {
    const brief = buildBrief({ angle: AdAngle.KREDIT_SYARIAH });
    expect(builder.buildVideoPrompt(brief, true)).toContain("Islamic finance");
  });

  it("GUDANGNYA -> video prompt includes 'large selection'", () => {
    const brief = buildBrief({ angle: AdAngle.GUDANGNYA });
    expect(builder.buildVideoPrompt(brief, true)).toContain("large selection");
  });

  it("all video prompts are in English (no Indonesian words)", () => {
    for (const angle of Object.values(AdAngle)) {
      const brief = buildBrief({ angle });
      const prompt = builder.buildVideoPrompt(brief, true).toLowerCase();
      for (const marker of INDONESIAN_MARKERS) {
        expect(prompt).not.toMatch(new RegExp(`\\b${marker}\\b`));
      }
    }
  });

  it("all image prompts are in English (no Indonesian words)", () => {
    for (const angle of Object.values(AdAngle)) {
      const brief = buildBrief({ angle });
      const prompt = builder.buildImagePrompt(brief, 0).toLowerCase();
      for (const marker of INDONESIAN_MARKERS) {
        expect(prompt).not.toMatch(new RegExp(`\\b${marker}\\b`));
      }
    }
  });

  it("unit name is included in the video prompt", () => {
    const brief = buildBrief({ unit: "Xpander Cross 2019" });
    expect(builder.buildVideoPrompt(brief, true)).toContain("Xpander Cross 2019");
  });

  it("unit name is included in the image prompt", () => {
    const brief = buildBrief({ unit: "Xpander Cross 2019" });
    expect(builder.buildImagePrompt(brief, 0)).toContain("Xpander Cross 2019");
  });

  it(
    "REAL BUG FIX regression guard: prefers unitModel (a real human-readable name) over unit " +
      "(the scraped identityKey/slug) — a real generation's video prompt used to read " +
      "'...toyota-avanza-g-2023-66e041ab in modern Indonesian car showroom...' instead of the " +
      "real model name",
    () => {
      const brief = buildBrief({
        unit: "toyota-avanza-g-2023-66e041ab",
        unitModel: "Toyota Avanza G 2023",
      });
      const videoPrompt = builder.buildVideoPrompt(brief, true);
      const imagePrompt = builder.buildImagePrompt(brief, 0);
      expect(videoPrompt).toContain("Toyota Avanza G 2023");
      expect(videoPrompt).not.toContain("toyota-avanza-g-2023-66e041ab");
      expect(imagePrompt).toContain("Toyota Avanza G 2023");
      expect(imagePrompt).not.toContain("toyota-avanza-g-2023-66e041ab");
    },
  );

  it("falls back to unit (the slug) when unitModel is absent — e.g. a Tamara brief with no scraped stock match", () => {
    const brief = buildBrief({ unit: "some-ad-name-with-no-stock-match", unitModel: undefined });
    expect(builder.buildVideoPrompt(brief, true)).toContain("some-ad-name-with-no-stock-match");
  });

  it("branch is included in the video prompt (title-cased)", () => {
    const brief = buildBrief({ branch: Branch.BINTARO });
    expect(builder.buildVideoPrompt(brief, true)).toContain("Bintaro");
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
    expect(builder.buildImagePrompt(brief, 0)).toContain("variant 1");
    expect(builder.buildImagePrompt(brief, 2)).toContain("variant 3");
  });

  it("uspMessages presence adds a generic English trust clause (COORDINATOR NOTE #4), never the raw Indonesian text", () => {
    const brief = buildBrief({ uspMessages: ["DP mulai 10 juta sudah bisa bawa pulang"] });
    const prompt = builder.buildVideoPrompt(brief, true);
    expect(prompt).toContain("emphasizing verified quality and buyer trust");
    expect(prompt).not.toContain("bawa pulang");
  });

  it("no uspMessages -> no trust clause added", () => {
    const brief = buildBrief({ uspMessages: undefined });
    expect(builder.buildVideoPrompt(brief, true)).not.toContain("emphasizing verified quality");
  });

  it("empty uspMessages array behaves the same as undefined", () => {
    const brief = buildBrief({ uspMessages: [] });
    expect(builder.buildVideoPrompt(brief, true)).not.toContain("emphasizing verified quality");
  });

  it("image prompt also gets the uspMessages trust clause when present", () => {
    const brief = buildBrief({ uspMessages: ["Stok puluhan unit ready"] });
    expect(builder.buildImagePrompt(brief, 0)).toContain(
      "emphasizing verified quality and buyer trust",
    );
  });
});
