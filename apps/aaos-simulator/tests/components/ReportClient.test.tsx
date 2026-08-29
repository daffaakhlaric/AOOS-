import { Verdict } from "@aos/ai-judge";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportClient } from "@/components/report/ReportClient";
import type { ApiErrorResponse, SimulateAllResponse } from "@/types/simulator.types";

import { buildAllScenariosReport, buildSimulateAllResultEntry, TEST_PERSONAS } from "../fixtures";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("ReportClient", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading spinner immediately, then calls POST /api/simulate-all", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ results: [], report: buildAllScenariosReport() }));
    render(<ReportClient personas={TEST_PERSONAS} />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith("/api/simulate-all", { method: "POST" });

    // Let the mocked fetch's pending resolution settle inside `act` before the test ends.
    await waitFor(() => expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument());
  });

  it("renders the report once the run completes", async () => {
    const body: SimulateAllResponse = {
      results: [buildSimulateAllResultEntry()],
      report: buildAllScenariosReport(),
    };
    fetchSpy.mockResolvedValue(jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);

    await waitFor(() => expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument());
    expect(screen.getByTestId("all-scenarios-table")).toBeInTheDocument();
    expect(screen.getByTestId("weakest-dimensions-chart")).toBeInTheDocument();
  });

  it("renders topPriorities when present", async () => {
    const body: SimulateAllResponse = {
      results: [],
      report: buildAllScenariosReport({ topPriorities: ["Perbaiki objection handling."] }),
    };
    fetchSpy.mockResolvedValue(jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("top-priorities")).toBeInTheDocument());
    expect(screen.getByText("Perbaiki objection handling.")).toBeInTheDocument();
  });

  it("shows an ErrorCard when the API responds with an error envelope", async () => {
    const errorBody: ApiErrorResponse = {
      error: { code: "INTERNAL", message: "Gagal menjalankan simulasi." },
    };
    fetchSpy.mockResolvedValue(jsonResponse(errorBody, false));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText("Gagal menjalankan simulasi.")).toBeInTheDocument();
  });

  it("allows approving Clara for deploy once the report has loaded (local state only, no extra fetch)", async () => {
    const user = userEvent.setup();
    const body: SimulateAllResponse = {
      results: [buildSimulateAllResultEntry()],
      report: buildAllScenariosReport({ overallVerdict: Verdict.APPROVE }),
    };
    fetchSpy.mockResolvedValue(jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("approve-button")).toBeInTheDocument());

    await user.click(screen.getByTestId("approve-button"));
    expect(screen.getByTestId("approve-confirmation")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
