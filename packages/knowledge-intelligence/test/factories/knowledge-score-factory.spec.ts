import { describe, expect, it } from "vitest";

import { KnowledgeScoreFactory } from "../../src/factories/knowledge-score-factory.js";

describe("KnowledgeScoreFactory", () => {
  it("creates a score with the evaluated band", () => {
    const factory = new KnowledgeScoreFactory();
    const score = factory.create("quality", 85, [
      { label: "good", min: 80 },
      { label: "poor", min: 0 },
    ]);
    expect(score.value).toBe(85);
    expect(score.band).toBe("good");
  });
});
