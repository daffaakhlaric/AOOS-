import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DimensionScoreBar } from "@/components/ui/DimensionScoreBar";

import { buildDimensionScore, buildNotApplicableDimensionScore } from "../fixtures";

describe("DimensionScoreBar", () => {
  it("renders the label", () => {
    render(
      <DimensionScoreBar label="Natural Language" score={buildDimensionScore({ score: 8 })} />,
    );
    expect(screen.getByText("Natural Language")).toBeInTheDocument();
  });

  it("shows the score formatted as X.X/10", () => {
    render(
      <DimensionScoreBar label="Natural Language" score={buildDimensionScore({ score: 8.5 })} />,
    );
    expect(screen.getByTestId("dimension-score-value")).toHaveTextContent("8.5/10");
  });

  it("fill width is proportional to score (score=5 -> 50%)", () => {
    render(<DimensionScoreBar label="Qualification" score={buildDimensionScore({ score: 5 })} />);
    const fill = screen.getByTestId("dimension-score-fill");
    expect(fill).toHaveStyle({ width: "50%" });
  });

  it('shows "N/A" instead of a fill bar for a not-applicable dimension', () => {
    render(
      <DimensionScoreBar
        label="Objection Handling"
        score={buildNotApplicableDimensionScore("NO_OBJECTION_PRESENT")}
      />,
    );
    expect(screen.getByTestId("dimension-score-value")).toHaveTextContent("N/A");
    expect(screen.queryByTestId("dimension-score-fill")).not.toBeInTheDocument();
  });
});
