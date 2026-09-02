import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyObjectiveForm } from "@/components/objective/PropertyObjectiveForm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("PropertyObjectiveForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation errors instead of calling onSubmit with bad values", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ available: false, reason: "Belum ada data campaign." }),
    ) as unknown as typeof fetch;
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    // Target defaults to 50 (valid); clear budget/focus/area to trigger the budget error first.
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(await screen.findByText("Budget iklan harus lebih dari 0.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires at least 1 focus listing and 1 area priority", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ available: false, reason: "Belum ada data campaign." }),
    ) as unknown as typeof fetch;
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText("cth. 30000000"), "10000000");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(await screen.findByText("Isi minimal 1 fokus listing.")).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText("cth. Cluster Anggrek, Rumah Blok C5"),
      "Cluster Anggrek",
    );
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(await screen.findByText("Isi minimal 1 area prioritas.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fetches a real budget suggestion on blur of Target Hot Leads and pre-fills the editable budget field", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      expect(String(input)).toContain("/api/property-objective/budget-suggestion");
      expect(String(input)).toContain("targetHotLeads=50");
      return jsonResponse({
        available: true,
        suggestedBudget: 12_500_000,
        portfolioAvgCplIDR: 250_000,
        targetHotLeads: 50,
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PropertyObjectiveForm onSubmit={vi.fn()} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab(); // blur triggers the suggestion fetch

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const budgetInput = await screen.findByPlaceholderText<HTMLInputElement>("cth. 30000000");
    await waitFor(() => expect(budgetInput.value).toBe("12500000"));
    expect(screen.getByTestId("budget-suggestion-hint")).toHaveTextContent(/Saran Samantha/);
  });

  it("shows the real honest unavailable reason and leaves the budget field for manual entry", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ available: false, reason: "Belum ada data campaign untuk tenant ini." }),
    ) as unknown as typeof fetch;
    render(<PropertyObjectiveForm onSubmit={vi.fn()} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab();

    expect(await screen.findByTestId("budget-suggestion-unavailable")).toHaveTextContent(
      /Belum ada data campaign untuk tenant ini/,
    );
    const budgetInput = screen.getByPlaceholderText<HTMLInputElement>("cth. 30000000");
    expect(budgetInput.value).toBe("");
  });

  it("flips budgetSource from SAMANTHA_SUGGESTED to MANUAL the moment the user edits the budget field", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        available: true,
        suggestedBudget: 12_500_000,
        portfolioAvgCplIDR: 250_000,
        targetHotLeads: 50,
      }),
    ) as unknown as typeof fetch;
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab();

    const budgetInput = await screen.findByPlaceholderText<HTMLInputElement>("cth. 30000000");
    await waitFor(() => expect(budgetInput.value).toBe("12500000"));

    // Manual edit: clear and retype.
    await userEvent.clear(budgetInput);
    await userEvent.type(budgetInput, "20000000");

    await userEvent.type(
      screen.getByPlaceholderText("cth. Cluster Anggrek, Rumah Blok C5"),
      "Cluster Anggrek",
    );
    await userEvent.type(screen.getByPlaceholderText("cth. Bintaro, Serpong, BSD"), "Bintaro");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0]![0] as { budgetSource: string; budgetAllocation: number };
    expect(values.budgetSource).toBe("MANUAL");
    expect(values.budgetAllocation).toBe(20_000_000);
  });

  it("submits the real CreatePropertyObjectiveBodyDto shape with budgetSource SAMANTHA_SUGGESTED when the user accepted the suggestion untouched", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        available: true,
        suggestedBudget: 12_500_000,
        portfolioAvgCplIDR: 250_000,
        targetHotLeads: 50,
      }),
    ) as unknown as typeof fetch;
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab();

    const budgetInput = await screen.findByPlaceholderText<HTMLInputElement>("cth. 30000000");
    await waitFor(() => expect(budgetInput.value).toBe("12500000"));

    await userEvent.type(
      screen.getByPlaceholderText("cth. Cluster Anggrek, Rumah Blok C5"),
      "Cluster Anggrek, Rumah Blok C5",
    );
    await userEvent.type(screen.getByPlaceholderText("cth. Bintaro, Serpong, BSD"), "Bintaro, BSD");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      targetHotLeads: 50,
      budgetAllocation: 12_500_000,
      budgetSource: "SAMANTHA_SUGGESTED",
      focusListings: ["Cluster Anggrek", "Rumah Blok C5"],
      areaPriorities: ["Bintaro", "BSD"],
    });
  });
});
