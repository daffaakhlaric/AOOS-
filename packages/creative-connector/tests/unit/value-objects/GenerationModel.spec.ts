import { describe, expect, it } from "vitest";

import {
  GENERATION_MODEL_REGISTRY,
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
});
