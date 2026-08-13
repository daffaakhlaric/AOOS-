import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricsSummaryBar } from "@/components/meta-ads/MetricsSummaryBar";

describe("MetricsSummaryBar", () => {
  it("renders Belanja · Chat · D2 · D3 · D5 · Form · Total Lead", () => {
    render(
      <MetricsSummaryBar
        totals={{
          spend: 26_400_000,
          conversations: 2866,
          d2: 1914,
          d3: 1286,
          d5: 1349,
          leadForm: 163,
          totalLead: 2798,
          rphD3: null,
        }}
      />,
    );
    expect(screen.getByText("Belanja")).toBeInTheDocument();
    expect(screen.getByText("Rp 26.4jt")).toBeInTheDocument();
    expect(screen.getByText("2.866")).toBeInTheDocument();
    expect(screen.getByText("1.286")).toBeInTheDocument();
    expect(screen.getByText("2.798")).toBeInTheDocument();
  });
});
