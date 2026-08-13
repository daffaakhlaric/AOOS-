import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HotLeadCard } from "@/components/leads/HotLeadCard";
import type { LeadDto } from "@/types/crm.types";

function makeLead(overrides: Partial<LeadDto> = {}): LeadDto {
  return {
    id: "lead-1",
    leadPhone: "+6281234567890",
    leadName: "Pak Andi",
    branchId: "CINERE",
    status: "HOT",
    temperature: "HOT",
    score: 85,
    qualification: {
      budget: true,
      unit: true,
      area: true,
      payment: true,
      timeline: true,
      name: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("HotLeadCard", () => {
  it("renders lead name, score, and branch", () => {
    render(<HotLeadCard lead={makeLead()} salesHumanId="sales-rina" />);
    expect(screen.getByText(/Pak Andi/)).toBeInTheDocument();
    expect(screen.getByText(/Skor 85/)).toBeInTheDocument();
  });

  it("shows the Claim Lead button when unassigned", () => {
    render(<HotLeadCard lead={makeLead()} salesHumanId="sales-rina" />);
    expect(screen.getByRole("button", { name: "Claim Lead →" })).toBeInTheDocument();
  });

  it("shows 'Diklaim [nama]' when assigned", () => {
    render(
      <HotLeadCard lead={makeLead({ assignedSalesId: "sales-budi" })} salesHumanId="sales-rina" />,
    );
    expect(screen.getByTestId("already-claimed")).toHaveTextContent("Diklaim sales-budi");
  });

  it("HOT badge renders with red/danger tone classes", () => {
    render(<HotLeadCard lead={makeLead()} salesHumanId="sales-rina" />);
    expect(screen.getByTestId("lead-status-badge")).toHaveClass("text-brand-danger");
  });

  it("renders qualification badges", () => {
    render(<HotLeadCard lead={makeLead()} salesHumanId="sales-rina" />);
    expect(screen.getByTestId("qualification-badges")).toBeInTheDocument();
  });
});
