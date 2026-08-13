import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";

describe("LeadStatusBadge", () => {
  it("renders HOT with the danger (red) tone", () => {
    render(<LeadStatusBadge status="HOT" />);
    expect(screen.getByTestId("lead-status-badge")).toHaveClass("text-brand-danger");
  });

  it("renders WARM with the warning tone", () => {
    render(<LeadStatusBadge status="WARM" />);
    expect(screen.getByTestId("lead-status-badge")).toHaveClass("text-brand-warning");
  });

  it("renders ASSIGNED with the success tone", () => {
    render(<LeadStatusBadge status="ASSIGNED" />);
    expect(screen.getByText("ASSIGNED")).toBeInTheDocument();
  });

  it("falls back to neutral for an unknown status", () => {
    render(<LeadStatusBadge status="WHATEVER" />);
    expect(screen.getByTestId("lead-status-badge")).toHaveClass("text-ink-muted");
  });
});
