import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryCards } from "@/components/dashboard/SummaryCards";

const DATA = {
  spend: 26_400_000,
  spendChangePercent: 12,
  d3Leads: 1286,
  d3ChangePercent: 8,
  hotLeads: 47,
  hotLeadsChangePercent: 15,
  closings: 12,
  closingsChangePercent: 20,
};

describe("SummaryCards", () => {
  it("renders 4 KPI cards with correct values", () => {
    render(<SummaryCards data={DATA} />);
    expect(screen.getAllByTestId("metric-card")).toHaveLength(4);
    expect(screen.getByText("1.286")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows % change vs previous period for each card", () => {
    render(<SummaryCards data={DATA} />);
    expect(screen.getByText(/↑ 12%/)).toBeInTheDocument();
    expect(screen.getByText(/↑ 8%/)).toBeInTheDocument();
    expect(screen.getByText(/↑ 15%/)).toBeInTheDocument();
    expect(screen.getByText(/↑ 20%/)).toBeInTheDocument();
  });

  it("renders the compact rupiah value for spend", () => {
    render(<SummaryCards data={DATA} />);
    expect(screen.getByText("Rp 26.4jt")).toBeInTheDocument();
  });
});
