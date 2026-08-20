import { describe, expect, it } from "vitest";

import { buildKaiPromptDetail } from "./kai-prompt-preview.js";

const BASE_INPUT = {
  unit: "Xpander",
  branch: "CINERE" as const,
  angle: "DP_RINGAN" as const,
  primaryMessage: "DP mulai 29 juta",
  tone: "casual",
  avoid: [] as readonly string[],
  formats: ["VIDEO_15S", "IMAGE_SQUARE"] as const,
  urgency: "HIGH" as const,
  sourcePhotoUrls: [] as readonly string[],
};

describe("buildKaiPromptDetail", () => {
  const WITH_PHOTO = { ...BASE_INPUT, sourcePhotoUrls: ["https://assets.example/photo-1.jpg"] };

  it("builds a real English video + 3 image prompts from AutomotivePromptBuilder, never fabricated text", () => {
    const detail = buildKaiPromptDetail(WITH_PHOTO);
    expect(detail).toBeDefined();
    expect(detail?.videoPrompt).toContain("Xpander");
    expect(detail?.videoPrompt).toContain("advertisement video");
    expect(detail?.imagePrompts).toHaveLength(3);
    detail?.imagePrompts.forEach((prompt) => {
      expect(prompt).toContain("Xpander");
    });
  });

  it("decides VIDEO_AND_IMAGES with a real VideoSpec when the brief requests a video format, urgency isn't LOW, and a real source photo exists (FormatDecider requires >=1)", () => {
    const detail = buildKaiPromptDetail(WITH_PHOTO);
    expect(detail?.format).toBe("VIDEO_AND_IMAGES");
    expect(detail?.videoModel).toBeDefined();
    expect(detail?.videoDurationSeconds).toBe(15);
  });

  it("falls back to IMAGES_ONLY when no real source photo exists, even with a video format requested (matches real FormatDecider: needs availablePhotos >= 1)", () => {
    const detail = buildKaiPromptDetail(BASE_INPUT);
    expect(detail?.format).toBe("IMAGES_ONLY");
    expect(detail?.videoPrompt).toBeUndefined();
  });

  it("decides IMAGES_ONLY (no video prompt) when the brief carries no video format", () => {
    const detail = buildKaiPromptDetail({ ...BASE_INPUT, formats: ["IMAGE_SQUARE"] });
    expect(detail?.format).toBe("IMAGES_ONLY");
    expect(detail?.videoPrompt).toBeUndefined();
    expect(detail?.videoModel).toBeUndefined();
  });

  it("produces the real 3 Indonesian copy variants (A/B/C) from CopyBuilder", () => {
    const detail = buildKaiPromptDetail(BASE_INPUT);
    expect(detail?.copyVariants).toHaveLength(3);
    expect(detail?.copyVariants.map((v) => v.variantLabel).sort()).toEqual(["A", "B", "C"]);
  });

  it("carries real source photo URLs through untouched — never a fabricated thumbnail", () => {
    const detail = buildKaiPromptDetail(WITH_PHOTO);
    expect(detail?.sourcePhotoUrls).toEqual(["https://assets.example/photo-1.jpg"]);
    // No "generated from text description only" clause once a real source photo exists.
    expect(detail?.videoPrompt).not.toContain("text description only");
  });

  it("reports zero source photos honestly when none were found (no fabricated thumbnail)", () => {
    const detail = buildKaiPromptDetail(BASE_INPUT);
    expect(detail?.sourcePhotoUrls).toEqual([]);
  });

  it("degrades to undefined (never throws) on an invalid angle/branch", () => {
    const detail = buildKaiPromptDetail({
      ...BASE_INPUT,
      angle: "NOT_A_REAL_ANGLE" as never,
    });
    expect(detail).toBeUndefined();
  });
});
