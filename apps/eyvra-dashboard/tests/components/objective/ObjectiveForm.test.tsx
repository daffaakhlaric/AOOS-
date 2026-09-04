import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ObjectiveForm } from "@/components/objective/ObjectiveForm";

describe("ObjectiveForm", () => {
  it("submits the current default values", async () => {
    const onSubmit = vi.fn();
    render(<ObjectiveForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander", "Brio"],
      areaPriorities: ["BINTARO"],
    });
  });

  it("validates target > 0", async () => {
    const onSubmit = vi.fn();
    render(<ObjectiveForm onSubmit={onSubmit} />);
    await userEvent.clear(screen.getByLabelText("Target Hot Leads"));
    await userEvent.type(screen.getByLabelText("Target Hot Leads"), "0");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(screen.getByText(/Target hot leads harus lebih dari 0/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts a plain IDR integer for the budget input", async () => {
    const onSubmit = vi.fn();
    render(<ObjectiveForm onSubmit={onSubmit} />);
    await userEvent.clear(screen.getByLabelText("Budget Iklan (IDR)"));
    await userEvent.type(screen.getByLabelText("Budget Iklan (IDR)"), "45000000");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ budgetAllocation: 45_000_000 }),
    );
  });

  it("requires at least one area priority", async () => {
    const onSubmit = vi.fn();
    render(<ObjectiveForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByLabelText("BINTARO"));
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(screen.getByText(/Pilih minimal 1 area prioritas/)).toBeInTheDocument();
  });

  it("disables the submit button while submitting", () => {
    render(<ObjectiveForm onSubmit={vi.fn()} submitting />);
    expect(screen.getByRole("button", { name: /Set Objective/ })).toBeDisabled();
  });
});
