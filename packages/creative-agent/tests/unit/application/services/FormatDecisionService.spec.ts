import { describe, expect, it } from "vitest";

import { FormatDecisionService } from "../../../../src/application/services/FormatDecisionService.js";
import { CreativeFormat } from "../../../../src/domain/value-objects/CreativeFormat.js";
import { FormatDecider } from "../../../../src/intelligence/FormatDecider.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";

describe("FormatDecisionService", () => {
  const service = new FormatDecisionService(new FormatDecider());

  it("returns a videoSpec when the decided format is VIDEO_AND_IMAGES", () => {
    const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
    const decision = service.decide(brief, 3);
    expect(decision.format).toBe(CreativeFormat.VIDEO_AND_IMAGES);
    expect(decision.videoSpec).toBeDefined();
  });

  it("omits videoSpec when the decided format is IMAGES_ONLY", () => {
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"], urgency: "HIGH" });
    const decision = service.decide(brief, 3);
    expect(decision.format).toBe(CreativeFormat.IMAGES_ONLY);
    expect(decision.videoSpec).toBeUndefined();
  });

  it("always returns an imageSpec regardless of format", () => {
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });
    const decision = service.decide(brief, 0);
    expect(decision.imageSpec).toBeDefined();
    expect(decision.imageSpec.count).toBe(3);
  });
});
