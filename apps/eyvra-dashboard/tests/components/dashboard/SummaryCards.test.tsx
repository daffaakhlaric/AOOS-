import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryCards } from "@/components/dashboard/SummaryCards";

const DATA = {
  hotLeads: 7,
  leadsTotal: 10,
  testDrive: 1,
  spk: 2,
  komisiTotal: 11_400_000,
  belanjaIklan: 3_100_000,
};

describe("SummaryCards", () => {
  it("renders Hot Leads / Leads Total / Test Drive / SPK / Komisi Total / Belanja Iklan", () => {
    render(<SummaryCards data={DATA} />);
    expect(screen.getByText("Hot Leads")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Leads Total")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Test Drive")).toBeInTheDocument();
    expect(screen.getByText("SPK")).toBeInTheDocument();
    expect(screen.getByText("Komisi Total")).toBeInTheDocument();
    expect(screen.getByText("Rp 11,4 jt")).toBeInTheDocument();
    expect(screen.getByText("Belanja Iklan")).toBeInTheDocument();
    expect(screen.getByText("Rp 3,1 jt")).toBeInTheDocument();
  });

  it("omits Belanja Iklan when there is no cached Meta pull yet (undefined, not 0)", () => {
    render(
      <SummaryCards data={{ hotLeads: 0, leadsTotal: 0, testDrive: 0, spk: 0, komisiTotal: 0 }} />,
    );
    expect(screen.queryByText("Belanja Iklan")).not.toBeInTheDocument();
  });

  it("shows zero-value cells in muted gray", () => {
    render(
      <SummaryCards data={{ hotLeads: 0, leadsTotal: 0, testDrive: 0, spk: 0, komisiTotal: 0 }} />,
    );
    const hotLeadsValue = screen.getAllByText("0")[0];
    expect(hotLeadsValue).toBeInTheDocument();
  });
});
