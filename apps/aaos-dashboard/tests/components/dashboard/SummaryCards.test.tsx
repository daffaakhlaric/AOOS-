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

  it("omits Belanja/D3 Lead entirely when spend/d3Leads are undefined — only 2 cards render (real bug fix: DashboardClient no longer has Meta Ads data to show, see SummaryCards.tsx's docstring)", () => {
    render(
      <SummaryCards
        data={{
          hotLeads: 47,
          hotLeadsChangePercent: 15,
          closings: 12,
          closingsChangePercent: 20,
        }}
      />,
    );
    expect(screen.getAllByTestId("metric-card")).toHaveLength(2);
    expect(screen.queryByText(/Belanja/)).not.toBeInTheDocument();
    expect(screen.queryByText(/D3 Lead/)).not.toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
