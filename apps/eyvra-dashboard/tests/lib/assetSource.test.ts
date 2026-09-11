import { describe, expect, it } from "vitest";

import { classifyAssetSource } from "@/lib/assetSource";

describe("classifyAssetSource — CREATIVE HUB real 'source' classification", () => {
  it("classifies KAI when aiModel is real and present", () => {
    expect(classifyAssetSource({ aiModel: "veo3_fast", creativeBriefId: undefined })).toBe("KAI");
  });

  it("classifies KAI when only creativeBriefId is present (aiModel omitted)", () => {
    expect(classifyAssetSource({ aiModel: undefined, creativeBriefId: "brief-1" })).toBe("KAI");
  });

  it("classifies MANUAL when neither aiModel nor creativeBriefId is set", () => {
    expect(classifyAssetSource({ aiModel: undefined, creativeBriefId: undefined })).toBe("MANUAL");
  });

  it("classifies MANUAL for a real UNIT_PHOTO-shaped asset (scraper upload, no AI fields at all)", () => {
    expect(
      classifyAssetSource({
        aiModel: undefined,
        creativeBriefId: undefined,
      }),
    ).toBe("MANUAL");
  });
});
