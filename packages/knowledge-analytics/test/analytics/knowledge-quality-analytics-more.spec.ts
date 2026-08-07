import { describe, expect, it } from "vitest";

import { KnowledgeQualityAnalytics } from "../../src/analytics/knowledge-quality-analytics.js";

describe("KnowledgeQualityAnalytics edge cases", () => {
  it("qualityScore is 0 when every check fails", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: false });
    expect(quality.qualityScore()).toBe(0);
  });

  it("qualityScore is 1 when every check succeeds", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: true });
    expect(quality.qualityScore()).toBe(1);
  });

  it("handles a long mixed sequence with exact rates", () => {
    const quality = new KnowledgeQualityAnalytics();
    for (let i = 0; i < 37; i += 1) quality.recordQualityCheck({ succeeded: true });
    for (let i = 0; i < 13; i += 1) quality.recordQualityCheck({ succeeded: false });
    expect(quality.checkCount()).toBe(50);
    expect(quality.successRate()).toBeCloseTo(37 / 50, 10);
  });
});
