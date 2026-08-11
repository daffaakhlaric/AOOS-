import { Verdict } from "@aos/ai-judge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverallVerdictCard } from "@/components/report/OverallVerdictCard";

import { buildAllScenariosReport } from "../fixtures";

describe("OverallVerdictCard", () => {
  it("shows the overall verdict badge", () => {
    render(
      <OverallVerdictCard report={buildAllScenariosReport({ overallVerdict: Verdict.APPROVE })} />,
    );
    expect(screen.getByTestId("verdict-badge")).toHaveAttribute("data-verdict", "APPROVE");
  });

  it("shows the rounded average score out of 100", () => {
    render(<OverallVerdictCard report={buildAllScenariosReport({ avgOverallScore: 82.4 })} />);
    expect(screen.getByTestId("avg-overall-score")).toHaveTextContent("82/100");
  });

  it("reflects a mixed report (overall APPROVE despite some per-persona NEEDS_IMPROVEMENT) exactly as computed — never second-guessed in the UI", () => {
    render(
      <OverallVerdictCard
        report={buildAllScenariosReport({ overallVerdict: Verdict.APPROVE, avgOverallScore: 79.9 })}
      />,
    );
    expect(screen.getByTestId("verdict-badge")).toHaveAttribute("data-verdict", "APPROVE");
    expect(screen.getByTestId("avg-overall-score")).toHaveTextContent("80/100");
  });
});
