import { Verdict } from "@aos/ai-judge";
import { describe, expect, it } from "vitest";

import {
  dimensionScoreColorClass,
  formatDimensionScore,
  formatDurationSeconds,
  formatIdr,
  formatOverallScore,
  isNotApplicableDimension,
  verdictColorClasses,
  verdictEmoji,
  verdictLabel,
} from "@/lib/formatters";

import { buildDimensionScore, buildNotApplicableDimensionScore } from "../fixtures";

describe("formatIdr", () => {
  it("formats a rupiah amount with thousands grouping", () => {
    expect(formatIdr(195_000_000)).toBe("Rp 195.000.000");
  });
});

describe("formatDimensionScore", () => {
  it("formats to one decimal place", () => {
    expect(formatDimensionScore(8)).toBe("8.0");
    expect(formatDimensionScore(6.25)).toBe("6.3");
  });
});

describe("formatOverallScore", () => {
  it("rounds to the nearest whole number", () => {
    expect(formatOverallScore(85.4)).toBe("85");
    expect(formatOverallScore(85.6)).toBe("86");
  });
});

describe("formatDurationSeconds", () => {
  it('formats milliseconds as "N detik"', () => {
    expect(formatDurationSeconds(23_000)).toBe("23 detik");
    expect(formatDurationSeconds(1_500)).toBe("2 detik");
  });
});

describe("dimensionScoreColorClass", () => {
  it("returns green for scores >= 8", () => {
    expect(dimensionScoreColorClass(8)).toBe("bg-brand-success");
    expect(dimensionScoreColorClass(10)).toBe("bg-brand-success");
  });

  it("returns amber for scores between 5 and 7", () => {
    expect(dimensionScoreColorClass(5)).toBe("bg-brand-warning");
    expect(dimensionScoreColorClass(7)).toBe("bg-brand-warning");
  });

  it("returns red for scores below 5", () => {
    expect(dimensionScoreColorClass(4.9)).toBe("bg-brand-danger");
    expect(dimensionScoreColorClass(0)).toBe("bg-brand-danger");
  });
});

describe("verdict formatters", () => {
  it("map APPROVE to a success color, ✅, and the label APPROVE", () => {
    expect(verdictColorClasses(Verdict.APPROVE)).toContain("text-brand-success");
    expect(verdictEmoji(Verdict.APPROVE)).toBe("✅");
    expect(verdictLabel(Verdict.APPROVE)).toBe("APPROVE");
  });

  it("map NEEDS_IMPROVEMENT to a warning color and ⚠️", () => {
    expect(verdictColorClasses(Verdict.NEEDS_IMPROVEMENT)).toContain("text-brand-warning");
    expect(verdictEmoji(Verdict.NEEDS_IMPROVEMENT)).toBe("⚠️");
  });

  it("map FAIL to a danger color and ❌", () => {
    expect(verdictColorClasses(Verdict.FAIL)).toContain("text-brand-danger");
    expect(verdictEmoji(Verdict.FAIL)).toBe("❌");
  });
});

describe("isNotApplicableDimension", () => {
  it("is true for the real NO_OBJECTION_PRESENT single-rule shape", () => {
    expect(isNotApplicableDimension(buildNotApplicableDimensionScore("NO_OBJECTION_PRESENT"))).toBe(
      true,
    );
  });

  it("is true for the real NO_HANDOFF_NEEDED single-rule shape", () => {
    expect(isNotApplicableDimension(buildNotApplicableDimensionScore("NO_HANDOFF_NEEDED"))).toBe(
      true,
    );
  });

  it("is false for a normal, evaluated dimension score", () => {
    expect(isNotApplicableDimension(buildDimensionScore())).toBe(false);
  });
});
