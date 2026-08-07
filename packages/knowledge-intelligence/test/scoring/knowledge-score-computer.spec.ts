import { describe, expect, it } from "vitest";

import { KnowledgeScoreComputer } from "../../src/scoring/knowledge-score-computer.js";

describe("KnowledgeScoreComputer", () => {
  const bands = [
    { label: "healthy", min: 80 },
    { label: "at_risk", min: 50 },
    { label: "critical", min: 0 },
  ];

  it("normalizes a value into [0, 100]", () => {
    const computer = new KnowledgeScoreComputer();
    expect(computer.normalize(5, 0, 10)).toBe(50);
  });

  it("aggregates weighted signals into a named KnowledgeScore with the correct band", () => {
    const computer = new KnowledgeScoreComputer();
    const score = computer.aggregate(
      "quality",
      [
        { name: "a", value: 90, weight: 1 },
        { name: "b", value: 70, weight: 1 },
      ],
      bands,
    );
    expect(score.name).toBe("quality");
    expect(score.value).toBe(80);
    expect(score.band).toBe("healthy");
  });

  it("evaluates a raw value against bands", () => {
    const computer = new KnowledgeScoreComputer();
    expect(computer.evaluate(20, bands)).toBe("critical");
  });
});
