import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentHotLeads } from "@/components/dashboard/RecentHotLeads";
import type { LeadDto } from "@/types/dashboard.types";

function buildLead(overrides: Partial<LeadDto> = {}): LeadDto {
  return {
    id: "lead-1",
    leadPhone: "+6281200000001",
    leadName: "Pak Andi",
    branchId: "CINERE",
    status: "NEW",
    temperature: "HOT",
    score: 90,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("RecentHotLeads", () => {
  it("renders only HOT leads", () => {
    render(
      <RecentHotLeads
        leads={[
          buildLead({ temperature: "HOT" }),
          buildLead({ id: "lead-2", temperature: "WARM" }),
        ]}
      />,
    );
    expect(screen.getByText("Pak Andi")).toBeInTheDocument();
    expect(screen.getAllByText("Pak Andi")).toHaveLength(1);
  });

  it("shows an empty state when there are no hot leads", () => {
    render(<RecentHotLeads leads={[buildLead({ temperature: "COLD" })]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("limits the list to at most 5 leads", () => {
    const leads = Array.from({ length: 8 }, (_, i) =>
      buildLead({ id: `lead-${i}`, leadName: `Lead ${i}` }),
    );
    render(<RecentHotLeads leads={leads} />);
    expect(screen.getByTestId("recent-hot-leads").children).toHaveLength(5);
  });

  it("falls back to leadPhone when leadName is missing", () => {
    render(
      <RecentHotLeads leads={[buildLead({ leadName: undefined, leadPhone: "+6281299999999" })]} />,
    );
    expect(screen.getByText("+6281299999999")).toBeInTheDocument();
  });
});
