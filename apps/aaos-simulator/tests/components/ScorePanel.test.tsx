import { Grade } from "@aos/ai-judge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScorePanel } from "@/components/simulator/ScorePanel";

import {
  buildDimensionScore,
  buildJudgementResult,
  buildNotApplicableDimensionScore,
} from "../fixtures";

describe("ScorePanel", () => {
  it('shows "Belum ada hasil" when there is no judgement result', () => {
    render(<ScorePanel judgementResult={undefined} />);
    expect(screen.getByTestId("score-panel-empty")).toBeInTheDocument();
  });

  it("renders all 6 dimension bars", () => {
    render(<ScorePanel judgementResult={buildJudgementResult()} />);
    expect(screen.getAllByTestId("dimension-score-bar")).toHaveLength(6);
  });

  it("renders the overall score out of 100", () => {
    render(<ScorePanel judgementResult={buildJudgementResult({ overallScore: 85.4 })} />);
    expect(screen.getByTestId("overall-score")).toHaveTextContent("85/100");
  });

  it("green (bg-brand-success) fill for a score >= 8", () => {
    render(
      <ScorePanel
        judgementResult={buildJudgementResult({
          naturalLanguage: buildDimensionScore({ dimension: "NATURAL_LANGUAGE", score: 8 }),
        })}
      />,
    );
    const fills = screen.getAllByTestId("dimension-score-fill");
    expect(fills[0]?.className).toContain("bg-brand-success");
  });

  it("amber (bg-brand-warning) fill for a score between 5 and 7", () => {
    render(
      <ScorePanel
        judgementResult={buildJudgementResult({
          naturalLanguage: buildDimensionScore({ dimension: "NATURAL_LANGUAGE", score: 6 }),
        })}
      />,
    );
    const fills = screen.getAllByTestId("dimension-score-fill");
    expect(fills[0]?.className).toContain("bg-brand-warning");
  });

  it("red (bg-brand-danger) fill for a score < 5", () => {
    render(
      <ScorePanel
        judgementResult={buildJudgementResult({
          naturalLanguage: buildDimensionScore({ dimension: "NATURAL_LANGUAGE", score: 3 }),
        })}
      />,
    );
    const fills = screen.getAllByTestId("dimension-score-fill");
    expect(fills[0]?.className).toContain("bg-brand-danger");
  });

  it('shows "N/A" for a dimension the real scorer marks not-applicable (NO_OBJECTION_PRESENT)', () => {
    render(
      <ScorePanel
        judgementResult={buildJudgementResult({
          objectionHandling: buildNotApplicableDimensionScore("NO_OBJECTION_PRESENT"),
        })}
      />,
    );
    const values = screen.getAllByTestId("dimension-score-value");
    expect(values.some((el) => el.textContent === "N/A")).toBe(true);
  });

  it("renders a GradeChip with the real grade", () => {
    render(<ScorePanel judgementResult={buildJudgementResult({ grade: Grade.B_PLUS })} />);
    expect(screen.getByTestId("grade-chip")).toHaveTextContent("B+");
  });

  it("renders a VerdictBadge with the real verdict", () => {
    render(<ScorePanel judgementResult={buildJudgementResult()} />);
    expect(screen.getByTestId("verdict-badge")).toBeInTheDocument();
  });
});
