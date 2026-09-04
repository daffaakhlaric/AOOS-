import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyObjectiveForm } from "@/components/objective/PropertyObjectiveForm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LISTINGS = {
  listings: [
    { id: "listing-1", title: "Cluster Anggrek" },
    { id: "listing-2", title: "Rumah Blok C5" },
  ],
};

/** Dispatches by URL pattern — `/api/listings` (the real listing picker fetch, on mount) vs
 * `/api/property-objective/budget-suggestion` (fired on Target Hot Leads blur/button) — the same
 * real form now calls both, unlike the old free-text version this test file predates. */
function mockFetch(
  budgetHandler: () => Response = () => jsonResponse({ available: false, reason: "n/a" }),
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: string | URL) => {
    const url = String(input);
    if (url.includes("/api/listings")) {
      return Promise.resolve(jsonResponse(LISTINGS));
    }
    if (url.includes("/api/property-objective/budget-suggestion")) {
      return Promise.resolve(budgetHandler());
    }
    return Promise.resolve(jsonResponse({ error: { message: "unhandled in test" } }, 500));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function checkListings(titles: readonly string[]): Promise<void> {
  await screen.findByText("Cluster Anggrek"); // real listings loaded
  for (const title of titles) {
    await userEvent.click(screen.getByRole("checkbox", { name: title }));
  }
}

describe("PropertyObjectiveForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation errors instead of calling onSubmit with bad values", async () => {
    mockFetch();
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    // Target defaults to 50 (valid); clear budget/focus/area to trigger the budget error first.
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(await screen.findByText("Budget iklan harus lebih dari 0.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires at least 1 real listing checked and 1 area priority", async () => {
    mockFetch();
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText("cth. 30000000"), "10000000");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(await screen.findByText("Pilih minimal 1 fokus listing.")).toBeInTheDocument();

    await checkListings(["Cluster Anggrek"]);
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    expect(await screen.findByText("Isi minimal 1 area prioritas.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders real listings from the Listing Manager as checkboxes, honestly empty when there are none", async () => {
    mockFetch();
    render(<PropertyObjectiveForm onSubmit={vi.fn()} />);

    expect(await screen.findByText("Cluster Anggrek")).toBeInTheDocument();
    expect(screen.getByText("Rumah Blok C5")).toBeInTheDocument();
  });

  it("shows an honest empty hint when the tenant has zero active listings", async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/listings")) {
        return Promise.resolve(jsonResponse({ listings: [] }));
      }
      return Promise.resolve(jsonResponse({ available: false, reason: "n/a" }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PropertyObjectiveForm onSubmit={vi.fn()} />);

    expect(
      await screen.findByText(/Belum ada listing aktif — tambahkan dulu di Listing Manager/),
    ).toBeInTheDocument();
  });

  it("fetches a real budget suggestion on blur of Target Hot Leads and pre-fills the editable budget field", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse({
        available: true,
        suggestedBudget: 12_500_000,
        portfolioAvgCplIDR: 250_000,
        targetHotLeads: 50,
      }),
    );
    render(<PropertyObjectiveForm onSubmit={vi.fn()} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab(); // blur triggers the suggestion fetch

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/property-objective/budget-suggestion"),
        ),
      ).toBe(true),
    );
    const budgetInput = await screen.findByPlaceholderText<HTMLInputElement>("cth. 30000000");
    await waitFor(() => expect(budgetInput.value).toBe("12500000"));
    expect(screen.getByTestId("budget-suggestion-hint")).toHaveTextContent(/Saran Samantha/);
  });

  it("shows the real honest unavailable reason and leaves the budget field for manual entry", async () => {
    mockFetch(() =>
      jsonResponse({ available: false, reason: "Belum ada data campaign untuk tenant ini." }),
    );
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

  it("surfaces a real error instead of silently doing nothing when the suggestion fetch fails", async () => {
    mockFetch(() => jsonResponse({ error: { message: "Meta pull failed" } }, 500));
    render(<PropertyObjectiveForm onSubmit={vi.fn()} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab();

    expect(await screen.findByTestId("budget-suggestion-error")).toHaveTextContent(
      "Meta pull failed",
    );
  });

  it("flips budgetSource from SAMANTHA_SUGGESTED to MANUAL the moment the user edits the budget field", async () => {
    mockFetch(() =>
      jsonResponse({
        available: true,
        suggestedBudget: 12_500_000,
        portfolioAvgCplIDR: 250_000,
        targetHotLeads: 50,
      }),
    );
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

    await checkListings(["Cluster Anggrek"]);
    await userEvent.type(screen.getByPlaceholderText("cth. Bintaro, Serpong, BSD"), "Bintaro");
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0]![0] as { budgetSource: string; budgetAllocation: number };
    expect(values.budgetSource).toBe("MANUAL");
    expect(values.budgetAllocation).toBe(20_000_000);
  });

  it("submits the real CreatePropertyObjectiveBodyDto shape with budgetSource SAMANTHA_SUGGESTED when the user accepted the suggestion untouched", async () => {
    mockFetch(() =>
      jsonResponse({
        available: true,
        suggestedBudget: 12_500_000,
        portfolioAvgCplIDR: 250_000,
        targetHotLeads: 50,
      }),
    );
    const onSubmit = vi.fn();
    render(<PropertyObjectiveForm onSubmit={onSubmit} />);

    const targetInput = screen.getByPlaceholderText("cth. 50");
    targetInput.focus();
    await userEvent.tab();

    const budgetInput = await screen.findByPlaceholderText<HTMLInputElement>("cth. 30000000");
    await waitFor(() => expect(budgetInput.value).toBe("12500000"));

    await checkListings(["Cluster Anggrek", "Rumah Blok C5"]);
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
