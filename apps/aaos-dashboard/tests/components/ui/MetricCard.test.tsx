import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "@/components/ui/MetricCard";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Belanja" value="Rp 26.4jt" />);
    expect(screen.getByText("Belanja")).toBeInTheDocument();
    expect(screen.getByText("Rp 26.4jt")).toBeInTheDocument();
  });

  it("shows an upward arrow and green tone for a positive change", () => {
    render(<MetricCard label="D3 Lead" value="1.286" changePercent={8} />);
    const change = screen.getByText(/↑ 8%/);
    expect(change).toHaveClass("text-brand-success");
  });

  it("shows a downward arrow and red tone for a negative change", () => {
    render(<MetricCard label="Closing" value="12" changePercent={-5} />);
    const change = screen.getByText(/↓ 5%/);
    expect(change).toHaveClass("text-brand-danger");
  });

  it("omits the change line when changePercent is not provided", () => {
    render(<MetricCard label="Hot Lead" value="47" />);
    expect(screen.queryByText(/↑|↓/)).not.toBeInTheDocument();
  });
});
