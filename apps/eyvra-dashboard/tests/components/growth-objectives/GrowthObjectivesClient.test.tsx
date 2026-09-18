import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GrowthObjectivesClient } from "@/components/growth-objectives/GrowthObjectivesClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const OBJECTIVE = {
  id: "go-1",
  tenantId: "tenant-1",
  metric: "HOT_LEADS",
  targetValue: 50,
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  budgetMode: "GOAL_FIRST",
  focusListingIds: [],
  areaStrategy: "SAMANTHA",
  manualAreas: [],
  automationMode: "ADVISOR",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const OBJECTIVE_WITH_PROGRESS = {
  ...OBJECTIVE,
  id: "go-2",
  status: "ON_TRACK",
  progress: { progressPct: 42 },
};

describe("GrowthObjectivesClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner before the fetch resolves", () => {
    global.fetch = vi.fn(() => new Promise(() => undefined)) as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "boom" } }, 500),
    ) as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows the empty state when there are no objectives", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ objectives: [] })) as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(screen.getByText("Belum ada Growth Objective — buat yang pertama.")).toBeInTheDocument();
  });

  it("renders a populated list with status badges and honest no-progress text", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ objectives: [OBJECTIVE, OBJECTIVE_WITH_PROGRESS] }),
    ) as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-grid")).toBeInTheDocument());

    const cards = screen.getAllByTestId("growth-objective-card");
    expect(cards).toHaveLength(2);
    expect(screen.getAllByText("Hot Leads")).toHaveLength(2);

    const badges = screen.getAllByTestId("objective-status-badge");
    expect(badges[0]).toHaveTextContent("Aktif");
    expect(badges[1]).toHaveTextContent("On Track");

    // Objective without `progress` shows the honest empty-progress text, never a fabricated 0%.
    expect(screen.getByText("Belum ada data progress")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("opens the create modal", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ objectives: [OBJECTIVE] }),
    ) as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-grid")).toBeInTheDocument());
    await userEvent.click(screen.getByText("+ Buat Growth Objective"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a validation error instead of submitting when required fields are missing", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ objectives: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    await userEvent.click(screen.getByText("+ Buat Growth Objective"));

    await userEvent.click(screen.getByText("Simpan"));
    expect(screen.getByText("Target Hot Leads wajib diisi dengan angka.")).toBeInTheDocument();
    // Only the initial list GET fired — no POST was sent for the invalid submit.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a validation error when endDate is before startDate", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ objectives: [] })) as unknown as typeof fetch;
    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    await userEvent.click(screen.getByText("+ Buat Growth Objective"));

    await userEvent.type(screen.getByLabelText("Target Hot Leads *"), "10");
    await userEvent.type(screen.getByLabelText("Tanggal Mulai *"), "2026-02-10");
    await userEvent.type(screen.getByLabelText("Tanggal Selesai *"), "2026-02-01");
    await userEvent.click(screen.getByText("Simpan"));

    expect(
      screen.getByText("Tanggal selesai harus sama atau setelah tanggal mulai."),
    ).toBeInTheDocument();
  });

  it("creates a Growth Objective successfully and refetches the list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ objectives: [] }))
      .mockResolvedValueOnce(jsonResponse({ objective: OBJECTIVE }))
      .mockResolvedValueOnce(jsonResponse({ objectives: [OBJECTIVE] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    await userEvent.click(screen.getByText("+ Buat Growth Objective"));

    await userEvent.type(screen.getByLabelText("Target Hot Leads *"), "50");
    await userEvent.type(screen.getByLabelText("Tanggal Mulai *"), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Tanggal Selesai *"), "2026-01-31");
    await userEvent.click(screen.getByText("Simpan"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("growth-objective-grid")).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const createCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createCall[0]).toBe("/api/growth-objectives");
    expect(createCall[1].method).toBe("POST");
    const sentBody = JSON.parse(createCall[1].body as string) as Record<string, unknown>;
    expect(sentBody).toMatchObject({
      metric: "HOT_LEADS",
      targetValue: 50,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      budgetMode: "GOAL_FIRST",
      areaStrategy: "SAMANTHA",
      automationMode: "ADVISOR",
    });
    expect(sentBody.focusListingIds).toBeUndefined();
    expect(sentBody.manualAreas).toBeUndefined();
  });

  it("shows an honest inline error when create fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ objectives: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Tanggal tidak valid." } }, 400));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<GrowthObjectivesClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    await userEvent.click(screen.getByText("+ Buat Growth Objective"));

    await userEvent.type(screen.getByLabelText("Target Hot Leads *"), "50");
    await userEvent.type(screen.getByLabelText("Tanggal Mulai *"), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Tanggal Selesai *"), "2026-01-31");
    await userEvent.click(screen.getByText("Simpan"));

    await waitFor(() => expect(screen.getByText("Tanggal tidak valid.")).toBeInTheDocument());
    // Modal stays open on failure — never a silent failure.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
