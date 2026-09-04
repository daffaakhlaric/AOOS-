import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricsSummaryBar } from "@/components/meta-ads/MetricsSummaryBar";

const TOTALS = {
  spend: 26_400_000,
  clicks: 5000,
  frequency: 0,
  conversations: 2866,
  d2: 1914,
  d3: 1286,
  d5: 1349,
  leadForm: 163,
  totalLead: 2798,
  rphD3: null,
  rphLead: null,
};

describe("MetricsSummaryBar", () => {
  it("renders Belanja · Chat · D3 · Total Lead", () => {
    render(<MetricsSummaryBar totals={TOTALS} />);
    expect(screen.getByText("Belanja")).toBeInTheDocument();
    expect(screen.getByText("Rp 26,4 jt")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("2.866")).toBeInTheDocument();
    expect(screen.getByText("D3")).toBeInTheDocument();
    expect(screen.getByText("1.286")).toBeInTheDocument();
    expect(screen.getByText("Total Lead")).toBeInTheDocument();
    expect(screen.getByText("2.798")).toBeInTheDocument();
  });

  it("does not render D2/D5/Form (FINAL UI REBUILD: trimmed to the reference's 6-cell strip)", () => {
    render(<MetricsSummaryBar totals={TOTALS} />);
    expect(screen.queryByText("D2")).not.toBeInTheDocument();
    expect(screen.queryByText("D5")).not.toBeInTheDocument();
    expect(screen.queryByText("Form")).not.toBeInTheDocument();
  });

  it("does not render Kampanye/Iklan when the counts are not given", () => {
    render(<MetricsSummaryBar totals={TOTALS} />);
    expect(screen.queryByText("Kampanye")).not.toBeInTheDocument();
    expect(screen.queryByText("Iklan")).not.toBeInTheDocument();
  });

  it("renders Kampanye/Iklan columns when campaignCount/adCount are given (MAAO2 redesign)", () => {
    render(<MetricsSummaryBar totals={TOTALS} campaignCount={20} adCount={28} />);
    expect(screen.getByText("Kampanye")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Iklan")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });
});
