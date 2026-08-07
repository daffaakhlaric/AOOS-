import { describe, expect, it } from "vitest";

import { KnowledgeScore } from "../../src/value-objects/knowledge-score.js";

describe("KnowledgeScore", () => {
  it("constructs a valid score", () => {
    const score = new KnowledgeScore({ name: "quality", value: 80, band: "good" });
    expect(score.name).toBe("quality");
    expect(score.value).toBe(80);
    expect(score.band).toBe("good");
  });

  it("is frozen (immutable)", () => {
    const score = new KnowledgeScore({ name: "quality", value: 80, band: "good" });
    expect(Object.isFrozen(score)).toBe(true);
  });

  it("throws for an empty name", () => {
    expect(() => new KnowledgeScore({ name: "  ", value: 50, band: "x" })).toThrow(RangeError);
  });

  it("throws for a value below 0", () => {
    expect(() => new KnowledgeScore({ name: "a", value: -1, band: "x" })).toThrow(RangeError);
  });

  it("throws for a value above 100", () => {
    expect(() => new KnowledgeScore({ name: "a", value: 101, band: "x" })).toThrow(RangeError);
  });

  it("accepts boundary values 0 and 100", () => {
    expect(new KnowledgeScore({ name: "a", value: 0, band: "x" }).value).toBe(0);
    expect(new KnowledgeScore({ name: "a", value: 100, band: "x" }).value).toBe(100);
  });
});
