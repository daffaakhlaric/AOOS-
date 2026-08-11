import { describe, expect, it } from "vitest";

import { Verdict, verdictFromScore } from "../../../../src/domain/value-objects/Verdict.js";

describe("verdictFromScore", () => {
  it("score 92 (Grade A) -> APPROVE", () => {
    expect(verdictFromScore(92)).toBe(Verdict.APPROVE);
  });

  it("score 83 (Grade B+) -> APPROVE", () => {
    expect(verdictFromScore(83)).toBe(Verdict.APPROVE);
  });

  it("score 80.0 (APPROVE threshold, inclusive) -> APPROVE", () => {
    expect(verdictFromScore(80.0)).toBe(Verdict.APPROVE);
  });

  it("score 79.9 (just below threshold) -> NEEDS_IMPROVEMENT", () => {
    expect(verdictFromScore(79.9)).toBe(Verdict.NEEDS_IMPROVEMENT);
  });

  it("score 75 (Grade B) -> NEEDS_IMPROVEMENT", () => {
    expect(verdictFromScore(75)).toBe(Verdict.NEEDS_IMPROVEMENT);
  });

  it("score 62 (Grade C) -> NEEDS_IMPROVEMENT", () => {
    expect(verdictFromScore(62)).toBe(Verdict.NEEDS_IMPROVEMENT);
  });

  it("score 60.0 (lower NEEDS_IMPROVEMENT boundary, inclusive) -> NEEDS_IMPROVEMENT", () => {
    expect(verdictFromScore(60.0)).toBe(Verdict.NEEDS_IMPROVEMENT);
  });

  it("score 59.9 (just below) -> FAIL", () => {
    expect(verdictFromScore(59.9)).toBe(Verdict.FAIL);
  });

  it("score 45 (Grade F) -> FAIL", () => {
    expect(verdictFromScore(45)).toBe(Verdict.FAIL);
  });

  it("score 0 -> FAIL", () => {
    expect(verdictFromScore(0)).toBe(Verdict.FAIL);
  });

  it("score 100 -> APPROVE", () => {
    expect(verdictFromScore(100)).toBe(Verdict.APPROVE);
  });
});
