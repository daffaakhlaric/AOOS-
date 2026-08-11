import { describe, expect, it } from "vitest";

import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";

describe("ConfidenceScore", () => {
  it("creates a valid 0-100 score", () => {
    const result = ConfidenceScore.create(75);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.toNumber()).toBe(75);
  });

  it("rounds a fractional score", () => {
    const result = ConfidenceScore.create(75.6);
    expect(result.ok && result.value.toNumber()).toBe(76);
  });

  it("rejects a negative score", () => {
    expect(ConfidenceScore.create(-1).ok).toBe(false);
  });

  it("rejects a score above 100", () => {
    expect(ConfidenceScore.create(101).ok).toBe(false);
  });

  it("rejects a non-finite score", () => {
    expect(ConfidenceScore.create(Number.NaN).ok).toBe(false);
  });

  it("fromCoverage(1) — 100% data coverage — yields confidence > 80 (pinned business-correctness value)", () => {
    const result = ConfidenceScore.fromCoverage(1);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.toNumber()).toBe(100);
    expect(result.ok && result.value.isAbove(80)).toBe(true);
  });

  it("fromCoverage(0) yields the floor confidence of 40", () => {
    const result = ConfidenceScore.fromCoverage(0);
    expect(result.ok && result.value.toNumber()).toBe(40);
  });

  it("fromCoverage(0.5) yields 70 — significantly lower than the full-coverage case", () => {
    const result = ConfidenceScore.fromCoverage(0.5);
    expect(result.ok && result.value.toNumber()).toBe(70);
    expect(result.ok && result.value.isAbove(80)).toBe(false);
  });

  it("fromCoverage rejects a fraction above 1", () => {
    expect(ConfidenceScore.fromCoverage(1.5).ok).toBe(false);
  });

  it("fromCoverage rejects a negative fraction", () => {
    expect(ConfidenceScore.fromCoverage(-0.1).ok).toBe(false);
  });

  it("fromCoverage rejects a non-finite fraction", () => {
    expect(ConfidenceScore.fromCoverage(Number.NaN).ok).toBe(false);
  });

  it("isAbove is strict (not inclusive)", () => {
    const result = ConfidenceScore.create(80);
    expect(result.ok && result.value.isAbove(80)).toBe(false);
  });

  it("equals compares by score", () => {
    const a = ConfidenceScore.create(50);
    const b = ConfidenceScore.create(50);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });
});
