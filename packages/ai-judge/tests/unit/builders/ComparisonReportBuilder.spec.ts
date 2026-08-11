import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { ComparisonReportBuilder } from "../../../src/builders/ComparisonReportBuilder.js";
import { JudgementResultBuilder } from "../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../src/config/AiJudgeConfig.js";
import { DimensionName } from "../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../src/domain/value-objects/DimensionScoreValue.js";
import { Verdict } from "../../../src/domain/value-objects/Verdict.js";

function dim(dimension: DimensionName, value: number) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
}

function buildResult(sessionId: string, values: Record<DimensionName, number>) {
  return JudgementResultBuilder.build({
    sessionId: SessionId.create(sessionId),
    personaId: PersonaId.SYARIAH_BUYER,
    personaDifficulty: PersonaDifficulty.MEDIUM,
    dimensions: {
      naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, values[DimensionName.NATURAL_LANGUAGE]),
      qualification: dim(DimensionName.QUALIFICATION, values[DimensionName.QUALIFICATION]),
      objectionHandling: dim(
        DimensionName.OBJECTION_HANDLING,
        values[DimensionName.OBJECTION_HANDLING],
      ),
      closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, values[DimensionName.CLOSING_ATTEMPT]),
      handoffQuality: dim(DimensionName.HANDOFF_QUALITY, values[DimensionName.HANDOFF_QUALITY]),
      responseLength: dim(DimensionName.RESPONSE_LENGTH, values[DimensionName.RESPONSE_LENGTH]),
    },
    config: DEFAULT_AI_JUDGE_CONFIG,
    now: new Date(2026, 0, 1),
  });
}

const BEFORE_VALUES: Record<DimensionName, number> = {
  [DimensionName.NATURAL_LANGUAGE]: 5,
  [DimensionName.QUALIFICATION]: 5,
  [DimensionName.OBJECTION_HANDLING]: 5,
  [DimensionName.CLOSING_ATTEMPT]: 5,
  [DimensionName.HANDOFF_QUALITY]: 5,
  [DimensionName.RESPONSE_LENGTH]: 5,
};

const AFTER_VALUES: Record<DimensionName, number> = {
  [DimensionName.NATURAL_LANGUAGE]: 9,
  [DimensionName.QUALIFICATION]: 3,
  [DimensionName.OBJECTION_HANDLING]: 5,
  [DimensionName.CLOSING_ATTEMPT]: 9,
  [DimensionName.HANDOFF_QUALITY]: 9,
  [DimensionName.RESPONSE_LENGTH]: 9,
};

describe("ComparisonReportBuilder", () => {
  it("computes overallScoreDelta and grade/verdict before+after", () => {
    const before = buildResult("s-before", BEFORE_VALUES);
    const after = buildResult("s-after", AFTER_VALUES);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));

    expect(report.personaId).toBe(PersonaId.SYARIAH_BUYER);
    expect(report.gradeBefore).toBe(before.grade);
    expect(report.gradeAfter).toBe(after.grade);
    expect(report.verdictBefore).toBe(Verdict.FAIL);
    expect(report.overallScoreDelta).toBeCloseTo(
      after.overallScore.value - before.overallScore.value,
      10,
    );
  });

  it("identifies improved, regressed, and unchanged dimensions", () => {
    const before = buildResult("s-before", BEFORE_VALUES);
    const after = buildResult("s-after", AFTER_VALUES);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));

    expect(report.improvedDimensions).toContain(DimensionName.NATURAL_LANGUAGE);
    expect(report.improvedDimensions).toContain(DimensionName.CLOSING_ATTEMPT);
    expect(report.regressedDimensions).toContain(DimensionName.QUALIFICATION);
    expect(report.unchangedDimensions).toContain(DimensionName.OBJECTION_HANDLING);
  });

  it("each dimensionDelta reports the correct before/after/delta triple", () => {
    const before = buildResult("s-before", BEFORE_VALUES);
    const after = buildResult("s-after", AFTER_VALUES);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));

    const qualDelta = report.dimensionDeltas.find(
      (d) => d.dimension === DimensionName.QUALIFICATION,
    );
    expect(qualDelta).toEqual({
      dimension: DimensionName.QUALIFICATION,
      before: 5,
      after: 3,
      delta: -2,
    });
  });

  it("verdictImproved is true when the verdict rank goes up", () => {
    const before = buildResult("s-before", BEFORE_VALUES); // FAIL
    const after = buildResult("s-after-2", {
      ...AFTER_VALUES,
      [DimensionName.QUALIFICATION]: 9,
      [DimensionName.OBJECTION_HANDLING]: 9,
    }); // should be APPROVE
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));
    expect(after.verdict).toBe(Verdict.APPROVE);
    expect(report.verdictImproved).toBe(true);
    expect(report.verdictRegressed).toBe(false);
  });

  it("verdictRegressed is true when the verdict rank goes down", () => {
    const before = buildResult("s-before-2", {
      [DimensionName.NATURAL_LANGUAGE]: 9,
      [DimensionName.QUALIFICATION]: 9,
      [DimensionName.OBJECTION_HANDLING]: 9,
      [DimensionName.CLOSING_ATTEMPT]: 9,
      [DimensionName.HANDOFF_QUALITY]: 9,
      [DimensionName.RESPONSE_LENGTH]: 9,
    }); // APPROVE
    const after = buildResult("s-after-3", BEFORE_VALUES); // FAIL
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));
    expect(before.verdict).toBe(Verdict.APPROVE);
    expect(after.verdict).toBe(Verdict.FAIL);
    expect(report.verdictRegressed).toBe(true);
    expect(report.verdictImproved).toBe(false);
  });

  it("summary mentions the direction and magnitude of the overall score change", () => {
    const before = buildResult("s-before", BEFORE_VALUES);
    const after = buildResult("s-after", AFTER_VALUES);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));
    expect(report.summary).toContain("naik");
  });

  it("summary says 'turun' when the score decreases", () => {
    const before = buildResult("s-before-4", AFTER_VALUES);
    const after = buildResult("s-after-4", BEFORE_VALUES);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));
    expect(report.summary).toContain("turun");
  });

  it("summary says 'tetap' when the score is unchanged", () => {
    const before = buildResult("s-before-5", BEFORE_VALUES);
    const after = buildResult("s-after-5", BEFORE_VALUES);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 2));
    expect(report.summary).toContain("tetap");
  });
});
