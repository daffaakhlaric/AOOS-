import { AdAngle } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { PRIMARY_TEXT_MAX_LENGTH } from "../../src/domain/entities/CopyVariant.js";
import { AutomotivePromptBuilder } from "../../src/intelligence/AutomotivePromptBuilder.js";
import { CopyBuilder } from "../../src/intelligence/CopyBuilder.js";
import { buildBrief, XPANDER_PRICE_CONTEXT } from "../fixtures/creativeBriefFixtures.js";
import { unwrap } from "../helpers/result.js";

describe("PromptQuality (integration)", () => {
  const promptBuilder = new AutomotivePromptBuilder();
  const copyBuilder = new CopyBuilder();

  it("Xpander Cross 2019 + DP_RINGAN + Bintaro -> video prompt contains unit, angle style, and branch", () => {
    const brief = buildBrief({
      unit: "Xpander Cross 2019",
      angle: AdAngle.DP_RINGAN,
      branch: Branch.BINTARO,
    });
    const prompt = promptBuilder.buildVideoPrompt(brief, true);

    expect(prompt).toContain("Xpander Cross 2019");
    expect(prompt).toContain("affordable");
    expect(prompt).toContain("Bintaro");
  });

  it("copy variant A: primaryText <= 125 chars (assert exact length, business correctness)", () => {
    const brief = buildBrief({
      unit: "Xpander Cross 2019",
      angle: AdAngle.DP_RINGAN,
      priceContext: XPANDER_PRICE_CONTEXT,
    });
    const variants = unwrap(copyBuilder.buildVariants(brief));
    const variantA = variants[0];
    expect(variantA).toBeDefined();
    expect(variantA?.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
  });

  it("copy variant A: includes DP amount from priceContext", () => {
    const brief = buildBrief({
      unit: "Xpander Cross 2019",
      angle: AdAngle.DP_RINGAN,
      priceContext: XPANDER_PRICE_CONTEXT,
    });
    const variants = unwrap(copyBuilder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("29 juta");
  });

  it("copy variant A: includes the monthly installment amount from priceContext", () => {
    const brief = buildBrief({ priceContext: XPANDER_PRICE_CONTEXT });
    const variants = unwrap(copyBuilder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("5,4 juta");
  });

  it("prompts across all 7 angles never leak the brief's Indonesian primaryMessage/tone/avoid text", () => {
    for (const angle of Object.values(AdAngle)) {
      const brief = buildBrief({
        angle,
        primaryMessage: "DP mulai 29 juta langsung bawa pulang unit impianmu",
        tone: "santai dan akrab seperti teman dekat",
        avoid: ["jangan terlalu formal", "hindari kata murahan"],
      });
      const videoPrompt = promptBuilder.buildVideoPrompt(brief, true);
      const imagePrompt = promptBuilder.buildImagePrompt(brief, 0);

      expect(videoPrompt).not.toContain("bawa pulang");
      expect(videoPrompt).not.toContain("santai");
      expect(imagePrompt).not.toContain("bawa pulang");
      expect(imagePrompt).not.toContain("santai");
    }
  });

  it("every angle's image prompt across all 3 variant indices stays well-formed and English-only", () => {
    for (const angle of Object.values(AdAngle)) {
      const brief = buildBrief({ angle });
      for (let variantIndex = 0; variantIndex < 3; variantIndex += 1) {
        const prompt = promptBuilder.buildImagePrompt(brief, variantIndex);
        expect(prompt).toContain("Professional automotive photography");
        expect(prompt).toContain(`variant ${String(variantIndex + 1)}`);
      }
    }
  });
});
