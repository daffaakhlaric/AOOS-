import { describe, expect, it } from "vitest";

import { HealthStatus } from "../../src/types/health-status.js";
import { KnowledgeHealthScore } from "../../src/value-objects/knowledge-health-score.js";

function makeProps(overrides: Partial<ConstructorParameters<typeof KnowledgeHealthScore>[0]> = {}) {
  return {
    overall: 80,
    quality: 80,
    freshness: 80,
    coverage: 80,
    risk: 20,
    status: HealthStatus.Healthy,
    ...overrides,
  };
}

describe("KnowledgeHealthScore", () => {
  it("constructs a valid composite score", () => {
    const score = new KnowledgeHealthScore(makeProps());
    expect(score.overall).toBe(80);
    expect(score.status).toBe(HealthStatus.Healthy);
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(new KnowledgeHealthScore(makeProps()))).toBe(true);
  });

  it.each(["overall", "quality", "freshness", "coverage", "risk"] as const)(
    "throws when %s is below 0",
    (key) => {
      expect(() => new KnowledgeHealthScore(makeProps({ [key]: -1 } as never))).toThrow(RangeError);
    },
  );

  it.each(["overall", "quality", "freshness", "coverage", "risk"] as const)(
    "throws when %s is above 100",
    (key) => {
      expect(() => new KnowledgeHealthScore(makeProps({ [key]: 101 } as never))).toThrow(
        RangeError,
      );
    },
  );
});
