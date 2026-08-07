import { describe, expect, it } from "vitest";

import { KnowledgeStalenessAnalyzer } from "../../src/services/knowledge-staleness-analyzer.js";

describe("KnowledgeStalenessAnalyzer", () => {
  const analyzer = new KnowledgeStalenessAnalyzer();

  it("reports not stale when age is under maxAgeMs", () => {
    const result = analyzer.analyze(0, 500, { maxAgeMs: 1000 });
    expect(result.stale).toBe(false);
    expect(result.ageMs).toBe(500);
  });

  it("reports stale when age exceeds maxAgeMs", () => {
    const result = analyzer.analyze(0, 2000, { maxAgeMs: 1000 });
    expect(result.stale).toBe(true);
  });

  it("reports not stale exactly at the threshold (strictly greater-than)", () => {
    const result = analyzer.analyze(0, 1000, { maxAgeMs: 1000 });
    expect(result.stale).toBe(false);
  });

  it("clamps negative age (now before lastUpdatedAt) to 0", () => {
    const result = analyzer.analyze(1000, 500, { maxAgeMs: 1000 });
    expect(result.ageMs).toBe(0);
    expect(result.stale).toBe(false);
  });

  it("returns maxAgeMs in the result", () => {
    const result = analyzer.analyze(0, 0, { maxAgeMs: 42 });
    expect(result.maxAgeMs).toBe(42);
  });

  it("reports ageMs 0 when lastUpdatedAt equals now", () => {
    const result = analyzer.analyze(500, 500, { maxAgeMs: 100 });
    expect(result.ageMs).toBe(0);
    expect(result.stale).toBe(false);
  });

  it("reports stale for a very large age relative to a small threshold", () => {
    const result = analyzer.analyze(0, 1_000_000, { maxAgeMs: 1 });
    expect(result.stale).toBe(true);
  });
});
