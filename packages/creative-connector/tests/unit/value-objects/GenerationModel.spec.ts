import { describe, expect, it } from "vitest";

import {
  GENERATION_MODEL_REGISTRY,
  GenerationQualityTier,
  resolveVideoModel,
} from "../../../src/domain/value-objects/GenerationModel.js";
import { ImageModel } from "../../../src/domain/value-objects/ImageModel.js";
import { VideoModel } from "../../../src/domain/value-objects/VideoModel.js";

describe("GENERATION_MODEL_REGISTRY", () => {
  it("has exactly 3 entries — the 3 real models this codebase calls", () => {
    expect(GENERATION_MODEL_REGISTRY).toHaveLength(3);
  });

  it("contains ImageModel.NANO_BANANA_PRO as an IMAGE entry with no speedTier", () => {
    const entry = GENERATION_MODEL_REGISTRY.find(
      (candidate) => candidate.value === ImageModel.NANO_BANANA_PRO,
    );
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("IMAGE");
    expect(entry?.speedTier).toBeUndefined();
  });

  it("contains VideoModel.VEO3 as a VIDEO entry with speedTier STANDARD", () => {
    const entry = GENERATION_MODEL_REGISTRY.find(
      (candidate) => candidate.value === VideoModel.VEO3,
    );
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("VIDEO");
    expect(entry?.speedTier).toBe("STANDARD");
  });

  it("contains VideoModel.VEO3_FAST as a VIDEO entry with speedTier FAST", () => {
    const entry = GENERATION_MODEL_REGISTRY.find(
      (candidate) => candidate.value === VideoModel.VEO3_FAST,
    );
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("VIDEO");
    expect(entry?.speedTier).toBe("FAST");
  });
});

describe("resolveVideoModel()", () => {
  it("HIGH -> VEO3", () => {
    expect(resolveVideoModel("HIGH")).toBe(VideoModel.VEO3);
  });

  it("MEDIUM -> VEO3_FAST", () => {
    expect(resolveVideoModel("MEDIUM")).toBe(VideoModel.VEO3_FAST);
  });

  it("LOW -> VEO3_FAST", () => {
    expect(resolveVideoModel("LOW")).toBe(VideoModel.VEO3_FAST);
  });

  it("no qualityTier argument at all -> identical to pre-PROMPT-50 behavior (HIGH)", () => {
    expect(resolveVideoModel("HIGH")).toBe(VideoModel.VEO3);
  });

  it("no qualityTier argument at all -> identical to pre-PROMPT-50 behavior (MEDIUM)", () => {
    expect(resolveVideoModel("MEDIUM")).toBe(VideoModel.VEO3_FAST);
  });
});

describe("resolveVideoModel() with PROMPT 50 qualityTier override", () => {
  it("DRAFT overrides HIGH urgency -> VEO3_FAST (cheaper/faster, regardless of urgency)", () => {
    expect(resolveVideoModel("HIGH", GenerationQualityTier.DRAFT)).toBe(VideoModel.VEO3_FAST);
  });

  it("DRAFT overrides MEDIUM urgency -> VEO3_FAST", () => {
    expect(resolveVideoModel("MEDIUM", GenerationQualityTier.DRAFT)).toBe(VideoModel.VEO3_FAST);
  });

  it("DRAFT overrides LOW urgency -> VEO3_FAST", () => {
    expect(resolveVideoModel("LOW", GenerationQualityTier.DRAFT)).toBe(VideoModel.VEO3_FAST);
  });

  it("PREMIUM overrides LOW urgency -> VEO3 (higher-quality, regardless of urgency)", () => {
    expect(resolveVideoModel("LOW", GenerationQualityTier.PREMIUM)).toBe(VideoModel.VEO3);
  });

  it("PREMIUM overrides MEDIUM urgency -> VEO3", () => {
    expect(resolveVideoModel("MEDIUM", GenerationQualityTier.PREMIUM)).toBe(VideoModel.VEO3);
  });

  it("PREMIUM overrides HIGH urgency -> VEO3 (same as HIGH would already produce)", () => {
    expect(resolveVideoModel("HIGH", GenerationQualityTier.PREMIUM)).toBe(VideoModel.VEO3);
  });

  it("STANDARD does NOT override -> falls back to existing urgency-based logic (HIGH -> VEO3)", () => {
    expect(resolveVideoModel("HIGH", GenerationQualityTier.STANDARD)).toBe(VideoModel.VEO3);
  });

  it("STANDARD does NOT override -> falls back to existing urgency-based logic (MEDIUM -> VEO3_FAST)", () => {
    expect(resolveVideoModel("MEDIUM", GenerationQualityTier.STANDARD)).toBe(VideoModel.VEO3_FAST);
  });

  it("STANDARD does NOT override -> falls back to existing urgency-based logic (LOW -> VEO3_FAST)", () => {
    expect(resolveVideoModel("LOW", GenerationQualityTier.STANDARD)).toBe(VideoModel.VEO3_FAST);
  });
});

describe("GenerationQualityTier", () => {
  it("has exactly the 3 real spec tier names: DRAFT, STANDARD, PREMIUM", () => {
    expect(Object.values(GenerationQualityTier).sort()).toEqual(["DRAFT", "PREMIUM", "STANDARD"]);
  });
});
