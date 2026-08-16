import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SalesTeamTable } from "@/components/branches/SalesTeamTable";
import type { SalesHumanDto } from "@/types/dashboard.types";

function buildSales(overrides: Partial<SalesHumanDto> = {}): SalesHumanDto {
  return {
    id: "sales-1",
    name: "Budi Santoso",
    waNumber: "+628120000001",
    status: "ON",
    maxLeadsPerDay: 10,
    todayLeadCount: 2,
    isAvailable: true,
    ...overrides,
  };
}

describe("SalesTeamTable", () => {
  it("renders sales with status badges", () => {
    render(<SalesTeamTable team={[buildSales()]} />);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
  });

  // StatusBadge is now a CSS Modules component (hashed class names) — tone is asserted via
  // `data-tone` rather than an exact Tailwind class string.
  it("ON renders a success-tone badge", () => {
    render(<SalesTeamTable team={[buildSales({ status: "ON" })]} />);
    expect(screen.getByText("ON")).toHaveAttribute("data-tone", "success");
  });

  it("BUSY renders a warning-tone badge", () => {
    render(<SalesTeamTable team={[buildSales({ status: "BUSY", name: "Rina Dewi" })]} />);
    expect(screen.getByText("BUSY")).toHaveAttribute("data-tone", "warning");
  });

  it("OFF renders a danger-tone badge", () => {
    render(<SalesTeamTable team={[buildSales({ status: "OFF", name: "Andi" })]} />);
    expect(screen.getByText("OFF")).toHaveAttribute("data-tone", "danger");
  });

  it("shows an empty state when the team is empty", () => {
    render(<SalesTeamTable team={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("calls onRemove when the Remove button is clicked", async () => {
    const onRemove = vi.fn();
    render(<SalesTeamTable team={[buildSales()]} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("sales-1");
  });
});
