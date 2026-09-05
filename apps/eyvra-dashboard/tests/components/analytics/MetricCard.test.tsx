import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "@/components/analytics/MetricCard";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="SPEND" value="Rp 1.000.000" />);
    expect(screen.getByText("SPEND")).toBeInTheDocument();
    expect(screen.getByText("Rp 1.000.000")).toBeInTheDocument();
  });

  it("renders no delta pill when delta is omitted (honest degrade, not fabricated)", () => {
    render(<MetricCard label="SPEND" value="Rp 1.000.000" />);
    expect(screen.queryByTestId("metric-card-delta")).not.toBeInTheDocument();
  });

  it("renders a green delta when higherIsBetter and the value went up", () => {
    render(<MetricCard label="LEAD" value="12" delta={{ percent: 20, higherIsBetter: true }} />);
    const delta = screen.getByTestId("metric-card-delta");
    expect(delta).toHaveTextContent("▲ 20%");
  });

  it("renders a red delta for a cost metric that went up (logic terbalik)", () => {
    render(
      <MetricCard label="CPL" value="Rp 50.000" delta={{ percent: 15, higherIsBetter: false }} />,
    );
    const delta = screen.getByTestId("metric-card-delta");
    expect(delta.className).toMatch(/deltaBad/);
  });

  it("renders no sparkline when omitted, and a sparkline path when >= 2 points are given", () => {
    const { rerender } = render(<MetricCard label="SPEND" value="Rp 1" />);
    expect(screen.queryByTestId("metric-card-sparkline")).not.toBeInTheDocument();

    rerender(<MetricCard label="SPEND" value="Rp 1" sparkline={[1, 2, 3, 2, 4]} />);
    expect(screen.getByTestId("metric-card-sparkline")).toBeInTheDocument();
  });
});
