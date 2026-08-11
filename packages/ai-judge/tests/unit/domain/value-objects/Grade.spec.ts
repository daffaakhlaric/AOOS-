import { describe, expect, it } from "vitest";

import { Grade, gradeFromScore } from "../../../../src/domain/value-objects/Grade.js";

describe("gradeFromScore", () => {
  it("score 92 -> Grade.A", () => {
    expect(gradeFromScore(92)).toBe(Grade.A);
  });

  it("score 83 -> Grade.B_PLUS", () => {
    expect(gradeFromScore(83)).toBe(Grade.B_PLUS);
  });

  it("score 75 -> Grade.B", () => {
    expect(gradeFromScore(75)).toBe(Grade.B);
  });

  it("score 62 -> Grade.C", () => {
    expect(gradeFromScore(62)).toBe(Grade.C);
  });

  it("score 45 -> Grade.F", () => {
    expect(gradeFromScore(45)).toBe(Grade.F);
  });

  it("pinned boundaries: 90.0 -> A", () => {
    expect(gradeFromScore(90.0)).toBe(Grade.A);
  });

  it("pinned boundaries: 89.9 -> B+", () => {
    expect(gradeFromScore(89.9)).toBe(Grade.B_PLUS);
  });

  it("pinned boundaries: 80.0 -> B+", () => {
    expect(gradeFromScore(80.0)).toBe(Grade.B_PLUS);
  });

  it("pinned boundaries: 79.9 -> B", () => {
    expect(gradeFromScore(79.9)).toBe(Grade.B);
  });

  it("pinned boundaries: 70.0 -> B", () => {
    expect(gradeFromScore(70.0)).toBe(Grade.B);
  });

  it("pinned boundaries: 69.9 -> C", () => {
    expect(gradeFromScore(69.9)).toBe(Grade.C);
  });

  it("pinned boundaries: 60.0 -> C", () => {
    expect(gradeFromScore(60.0)).toBe(Grade.C);
  });

  it("pinned boundaries: 59.9 -> F", () => {
    expect(gradeFromScore(59.9)).toBe(Grade.F);
  });

  it("Grade.B_PLUS renders as the literal 'B+' string", () => {
    expect(Grade.B_PLUS).toBe("B+");
  });
});
