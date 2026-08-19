import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SalesTeamTable } from "@/components/branches/SalesTeamTable";
import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";

function buildSales(overrides: Partial<SalesHumanAccountDto> = {}): SalesHumanAccountDto {
  return {
    id: "sales-1",
    name: "Budi Santoso",
    email: "budi.santoso@mobix.id",
    phone: "+628120000001",
    branchId: "BINTARO",
    status: "ON",
    maxLeadsPerDay: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastSignInAt: undefined,
    ...overrides,
  };
}

describe("SalesTeamTable", () => {
  it("renders sales with status badges", () => {
    render(<SalesTeamTable team={[buildSales()]} />);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("budi.santoso@mobix.id")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
  });

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

  it("shows an empty state with a Tambah Sales Human action when the team is empty", async () => {
    const onAddSales = vi.fn();
    render(<SalesTeamTable team={[]} onAddSales={onAddSales} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ Tambah Sales Human" }));
    expect(onAddSales).toHaveBeenCalled();
  });

  it("calls onEdit when the Edit button is clicked", async () => {
    const onEdit = vi.fn();
    render(<SalesTeamTable team={[buildSales()]} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("sales-1");
  });

  it("calls onResetPassword when the Reset PW button is clicked", async () => {
    const onResetPassword = vi.fn();
    render(<SalesTeamTable team={[buildSales()]} onResetPassword={onResetPassword} />);
    await userEvent.click(screen.getByRole("button", { name: "Reset PW" }));
    expect(onResetPassword).toHaveBeenCalledWith("sales-1");
  });

  it("calls onDeactivate when the Nonaktif button is clicked", async () => {
    const onDeactivate = vi.fn();
    render(<SalesTeamTable team={[buildSales()]} onDeactivate={onDeactivate} />);
    await userEvent.click(screen.getByRole("button", { name: "Nonaktif" }));
    expect(onDeactivate).toHaveBeenCalledWith("sales-1");
  });
});
