import { describe, expect, it } from "vitest";

import { KnowledgePriorityCalculator } from "../../src/services/knowledge-priority-calculator.js";

describe("KnowledgePriorityCalculator", () => {
  const calculator = new KnowledgePriorityCalculator();
  const rules = { baseWeight: 1, stalenessWeight: 2, dependencyWeight: 3 };

  it("computes a weighted sum of the three inputs", () => {
    const score = calculator.calculate(
      { basePriority: 5, stalenessRatio: 0.5, dependentCount: 2 },
      rules,
    );
    // 1*5 + 2*0.5 + 3*2 = 5 + 1 + 6 = 12
    expect(score).toBe(12);
  });

  it("returns 0 for all-zero inputs", () => {
    expect(
      calculator.calculate({ basePriority: 0, stalenessRatio: 0, dependentCount: 0 }, rules),
    ).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const input = { basePriority: 3, stalenessRatio: 1, dependentCount: 1 };
    expect(calculator.calculate(input, rules)).toBe(calculator.calculate(input, rules));
  });

  it("weighs stalenessRatio more with a higher stalenessWeight", () => {
    const low = calculator.calculate(
      { basePriority: 0, stalenessRatio: 1, dependentCount: 0 },
      { baseWeight: 1, stalenessWeight: 1, dependencyWeight: 1 },
    );
    const high = calculator.calculate(
      { basePriority: 0, stalenessRatio: 1, dependentCount: 0 },
      { baseWeight: 1, stalenessWeight: 10, dependencyWeight: 1 },
    );
    expect(high).toBeGreaterThan(low);
  });

  it("weighs dependentCount more with a higher dependencyWeight", () => {
    const low = calculator.calculate(
      { basePriority: 0, stalenessRatio: 0, dependentCount: 1 },
      { baseWeight: 1, stalenessWeight: 1, dependencyWeight: 1 },
    );
    const high = calculator.calculate(
      { basePriority: 0, stalenessRatio: 0, dependentCount: 1 },
      { baseWeight: 1, stalenessWeight: 1, dependencyWeight: 5 },
    );
    expect(high).toBeGreaterThan(low);
  });
});
