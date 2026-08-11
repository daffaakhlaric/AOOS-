import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeakestDimensionsChart } from "@/components/report/WeakestDimensionsChart";

describe("WeakestDimensionsChart", () => {
  it("renders one row per weakest dimension, weakest first", () => {
    render(
      <WeakestDimensionsChart
        weakestDimensions={[
          { dimension: "OBJECTION_HANDLING", avgScore: 6.2 },
          { dimension: "CLOSING_ATTEMPT", avgScore: 7.1 },
        ]}
      />,
    );
    const rows = screen.getAllByTestId("weakest-dimension-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Objection Handling");
    expect(rows[0]).toHaveTextContent("6.2/10");
    expect(rows[1]).toHaveTextContent("Closing Attempt");
  });

  it("renders an empty list gracefully", () => {
    render(<WeakestDimensionsChart weakestDimensions={[]} />);
    expect(screen.queryAllByTestId("weakest-dimension-row")).toHaveLength(0);
  });
});
