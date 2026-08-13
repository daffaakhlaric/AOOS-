import { describe, expect, it } from "vitest";

import { PromptBuildingService } from "../../../../src/application/services/PromptBuildingService.js";
import { AutomotivePromptBuilder } from "../../../../src/intelligence/AutomotivePromptBuilder.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";

describe("PromptBuildingService", () => {
  const service = new PromptBuildingService(new AutomotivePromptBuilder());

  it("builds a videoPrompt when needsVideo is true", () => {
    const built = service.build(buildBrief(), true, true);
    expect(built.videoPrompt).toBeDefined();
    expect(built.videoPrompt).toContain("Professional car advertisement video");
  });

  it("omits videoPrompt when needsVideo is false", () => {
    const built = service.build(buildBrief(), false, true);
    expect(built.videoPrompt).toBeUndefined();
  });

  it("always builds exactly 3 image prompts", () => {
    const built = service.build(buildBrief(), false, false);
    expect(built.imagePrompts).toHaveLength(3);
  });

  it("image prompts are indexed 1, 2, 3 (variant N)", () => {
    const built = service.build(buildBrief(), false, false);
    expect(built.imagePrompts[0]).toContain("variant 1");
    expect(built.imagePrompts[1]).toContain("variant 2");
    expect(built.imagePrompts[2]).toContain("variant 3");
  });

  it("passes sourcePhotoAvailable through to the video prompt builder", () => {
    const built = service.build(buildBrief(), true, false);
    expect(built.videoPrompt).toContain("generated from text description only");
  });
});
