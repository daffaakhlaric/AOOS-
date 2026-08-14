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
};

describe("MetricsSummaryBar", () => {
  it("renders Belanja · Chat · D2 · D3 · D5 · Form · Total Lead", () => {
    render(<MetricsSummaryBar totals={TOTALS} />);
    expect(screen.getByText("Belanja")).toBeInTheDocument();
    expect(screen.getByText("Rp 26.4jt")).toBeInTheDocument();
    expect(screen.getByText("2.866")).toBeInTheDocument();
    expect(screen.getByText("1.286")).toBeInTheDocument();
    expect(screen.getByText("2.798")).toBeInTheDocument();
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
