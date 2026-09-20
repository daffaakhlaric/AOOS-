import { describe, expect, it } from "vitest";

import type { AnglePerformanceResult } from "./angle-performance.js";
import { shortlistConcepts, type ConceptShortlistCandidate } from "./concept-shortlist.js";

function angleResult(
  angle: string,
  rank: number | undefined,
  cpl: number | undefined = rank !== undefined ? 10_000 * rank : undefined,
): AnglePerformanceResult {
  return {
    angle,
    packageCount: 1,
    aggregated: { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, cpl },
    dataSufficiency: {
      level: rank !== undefined ? "MEDIUM" : "INSUFFICIENT",
      score: rank !== undefined ? 60 : 10,
      reasons: [],
    },
    ...(rank !== undefined ? { rank } : {}),
  };
}

interface TestConcept extends ConceptShortlistCandidate {
  readonly id: string;
}

function concept(id: string, angle: string): TestConcept {
  return { id, angle };
}

describe("shortlistConcepts", () => {
  it("returns an honest empty shortlist for empty candidates", () => {
    const result = shortlistConcepts([], [], 8);
    expect(result.shortlisted).toEqual([]);
    expect(result.method).toBe("UNDIFFERENTIATED_FALLBACK");
    expect(result.rankedCount).toBe(0);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("returns an honest empty shortlist for a non-positive targetCount", () => {
    const candidates = [concept("c1", "URGENCY")];
    const zero = shortlistConcepts(candidates, [], 0);
    expect(zero.shortlisted).toEqual([]);
    expect(zero.method).toBe("UNDIFFERENTIATED_FALLBACK");

    const negative = shortlistConcepts(candidates, [], -3);
    expect(negative.shortlisted).toEqual([]);
  });

  it("degrades to UNDIFFERENTIATED_FALLBACK, preserving original order, when no candidate's angle is rankable", () => {
    const candidates = [
      concept("c1", "URGENCY"),
      concept("c2", "LIFESTYLE"),
      concept("c3", "EXCLUSIVE"),
    ];
    // No history at all.
    const noHistory = shortlistConcepts(candidates, [], 8);
    expect(noHistory.method).toBe("UNDIFFERENTIATED_FALLBACK");
    expect(noHistory.rankedCount).toBe(0);
    expect(noHistory.shortlisted.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);

    // History exists but every matching angle is below the MEDIUM bar (rank undefined).
    const insufficientHistory = [
      angleResult("URGENCY", undefined),
      angleResult("LIFESTYLE", undefined),
    ];
    const result = shortlistConcepts(candidates, insufficientHistory, 8);
    expect(result.method).toBe("UNDIFFERENTIATED_FALLBACK");
    expect(result.rankedCount).toBe(0);
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("truncates the undifferentiated fallback to targetCount without reordering", () => {
    const candidates = [
      concept("c1", "URGENCY"),
      concept("c2", "LIFESTYLE"),
      concept("c3", "EXCLUSIVE"),
      concept("c4", "SYARIAH"),
    ];
    const result = shortlistConcepts(candidates, [], 2);
    expect(result.method).toBe("UNDIFFERENTIATED_FALLBACK");
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result.notes.some((n) => n.includes("dipotong"))).toBe(true);
  });

  it("ranks candidates by real historical CPL ascending (best real CPL first), unranked ones kept after in original order", () => {
    const candidates = [
      concept("c1", "URGENCY"), // rank 2 (worse CPL)
      concept("c2", "LIFESTYLE"), // rank 1 (best CPL)
      concept("c3", "NEW_ANGLE"), // no history at all
      concept("c4", "EXCLUSIVE"), // below MEDIUM bar
    ];
    const history = [
      angleResult("URGENCY", 2),
      angleResult("LIFESTYLE", 1),
      angleResult("EXCLUSIVE", undefined),
    ];
    const result = shortlistConcepts(candidates, history, 8);
    expect(result.method).toBe("HISTORICAL_ANGLE_RANK");
    expect(result.rankedCount).toBe(2);
    // Ranked first (best CPL first), then unranked preserving original relative order (c3 before c4).
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c2", "c1", "c3", "c4"]);
  });

  it("narrows to targetCount, keeping the real-CPL-best-ranked candidates over unranked ones", () => {
    const candidates = [
      concept("c1", "A"),
      concept("c2", "B"),
      concept("c3", "C"), // unranked
      concept("c4", "D"), // unranked
    ];
    const history = [angleResult("A", 2), angleResult("B", 1)];
    const result = shortlistConcepts(candidates, history, 2);
    expect(result.method).toBe("HISTORICAL_ANGLE_RANK");
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(result.notes.some((n) => n.includes("dipotong"))).toBe(true);
  });

  it("returns all candidates, re-ordered by real rank, when targetCount exceeds candidate count", () => {
    const candidates = [concept("c1", "A"), concept("c2", "B")];
    const history = [angleResult("A", 2), angleResult("B", 1)];
    const result = shortlistConcepts(candidates, history, 24);
    expect(result.shortlisted).toHaveLength(2);
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("handles multiple candidates sharing the same rankable angle as a real tie, preserving their original relative order", () => {
    const candidates = [
      concept("c1", "URGENCY"),
      concept("c2", "URGENCY"),
      concept("c3", "LIFESTYLE"),
    ];
    const history = [angleResult("URGENCY", 1), angleResult("LIFESTYLE", 2)];
    const result = shortlistConcepts(candidates, history, 8);
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("ignores a duplicate angle entry in angleHistory, keeping the first occurrence's rank rather than overwriting it", () => {
    const candidates = [concept("c1", "URGENCY"), concept("c2", "LIFESTYLE")];
    // Duplicate URGENCY entries: first is rankable, second (should be ignored) is not.
    const history = [
      angleResult("URGENCY", 1),
      angleResult("URGENCY", undefined),
      angleResult("LIFESTYLE", 2),
    ];
    const result = shortlistConcepts(candidates, history, 8);
    expect(result.method).toBe("HISTORICAL_ANGLE_RANK");
    expect(result.rankedCount).toBe(2);
    expect(result.shortlisted.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});
