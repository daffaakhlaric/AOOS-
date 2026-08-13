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

  it("ON renders a green badge", () => {
    render(<SalesTeamTable team={[buildSales({ status: "ON" })]} />);
    expect(screen.getByText("ON")).toHaveClass("text-brand-success");
  });

  it("BUSY renders an amber badge", () => {
    render(<SalesTeamTable team={[buildSales({ status: "BUSY", name: "Rina Dewi" })]} />);
    expect(screen.getByText("BUSY")).toHaveClass("text-brand-warning");
  });

  it("OFF renders a red badge", () => {
    render(<SalesTeamTable team={[buildSales({ status: "OFF", name: "Andi" })]} />);
    expect(screen.getByText("OFF")).toHaveClass("text-brand-danger");
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
