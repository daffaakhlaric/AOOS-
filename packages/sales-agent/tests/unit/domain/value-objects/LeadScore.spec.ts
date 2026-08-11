import { describe, expect, it } from "vitest";

import {
  LeadScore,
  MAX_LEAD_SCORE,
  MIN_LEAD_SCORE,
} from "../../../../src/domain/value-objects/LeadScore.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("LeadScore", () => {
  it("zero() starts at 0", () => {
    expect(LeadScore.zero().toNumber()).toBe(0);
  });

  it("create() accepts a valid finite number", () => {
    expect(unwrap(LeadScore.create(50)).toNumber()).toBe(50);
  });

  it("create() rejects NaN", () => {
    expect(unwrapErr(LeadScore.create(Number.NaN)).message).toContain("finite number");
  });

  it("create() rejects Infinity", () => {
    expect(unwrapErr(LeadScore.create(Number.POSITIVE_INFINITY)).message).toContain(
      "finite number",
    );
  });

  it("create() clamps a value above 100 down to 100", () => {
    expect(unwrap(LeadScore.create(150)).toNumber()).toBe(MAX_LEAD_SCORE);
  });

  it("create() clamps a negative value up to 0", () => {
    expect(unwrap(LeadScore.create(-20)).toNumber()).toBe(MIN_LEAD_SCORE);
  });

  it("apply() adds a positive delta", () => {
    expect(LeadScore.zero().apply(25).toNumber()).toBe(25);
  });

  it("apply() never goes below 0 (floor)", () => {
    expect(LeadScore.zero().apply(-20).toNumber()).toBe(0);
  });

  it("apply() never goes above 100 (ceiling)", () => {
    expect(unwrap(LeadScore.create(90)).apply(25).toNumber()).toBe(100);
  });

  it("apply() returns a NEW instance, does not mutate the original", () => {
    const original = LeadScore.zero();
    const applied = original.apply(25);
    expect(original.toNumber()).toBe(0);
    expect(applied.toNumber()).toBe(25);
  });

  it("isAtLeast() is true when score meets the threshold", () => {
    expect(unwrap(LeadScore.create(65)).isAtLeast(65)).toBe(true);
  });

  it("isAtLeast() is false when score is below the threshold", () => {
    expect(unwrap(LeadScore.create(64)).isAtLeast(65)).toBe(false);
  });

  it("equals() compares by value", () => {
    expect(unwrap(LeadScore.create(50)).equals(unwrap(LeadScore.create(50)))).toBe(true);
    expect(unwrap(LeadScore.create(50)).equals(unwrap(LeadScore.create(51)))).toBe(false);
  });

  it("cumulative apply of budget+unit+area+payment reaches exactly 100", () => {
    const score = LeadScore.zero().apply(25).apply(25).apply(25).apply(25);
    expect(score.toNumber()).toBe(100);
  });
});
