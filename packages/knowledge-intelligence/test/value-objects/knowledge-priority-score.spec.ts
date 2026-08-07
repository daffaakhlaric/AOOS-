import { describe, expect, it } from "vitest";

import { KnowledgePriorityScore } from "../../src/value-objects/knowledge-priority-score.js";

describe("KnowledgePriorityScore", () => {
  it("constructs a valid priority score", () => {
    const score = new KnowledgePriorityScore({ itemId: "item-1", value: 75, band: "high" });
    expect(score.itemId).toBe("item-1");
    expect(score.value).toBe(75);
  });

  it("is frozen (immutable)", () => {
    expect(
      Object.isFrozen(new KnowledgePriorityScore({ itemId: "a", value: 1, band: "low" })),
    ).toBe(true);
  });

  it("throws for a value outside [0, 100]", () => {
    expect(() => new KnowledgePriorityScore({ itemId: "a", value: -1, band: "low" })).toThrow(
      RangeError,
    );
    expect(() => new KnowledgePriorityScore({ itemId: "a", value: 101, band: "low" })).toThrow(
      RangeError,
    );
  });
});
