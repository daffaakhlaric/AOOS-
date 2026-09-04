import { Verdict } from "@aos/ai-judge";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportClient } from "@/components/report/ReportClient";
import type { ApiErrorResponse, SimulateAllResponse } from "@/types/simulator.types";

import {
  buildAllScenariosReport,
  buildLearningBridgeStatus,
  buildPromptOverrideStatus,
  buildSimulateAllResultEntry,
  TEST_PERSONAS,
} from "../fixtures";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const TENANTS_BODY = {
  ok: true,
  tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
};

/** Stubs `GET /api/tenants` and routes every other call to `simulateAllResponse` — mirrors `SimulatorClient.test.tsx`'s own `stubTenantsThen` helper. */
function stubTenantsThen(fetchSpy: ReturnType<typeof vi.fn>, simulateAllResponse: Response): void {
  fetchSpy.mockImplementation((url: string) => {
    if (url === "/api/tenants") {
      return Promise.resolve(jsonResponse(TENANTS_BODY));
    }
    return Promise.resolve(simulateAllResponse);
  });
}

/** Waits for the real tenant selector to resolve, then clicks "Jalankan Semua Skenario". */
async function runAfterTenantResolves(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await waitFor(() => expect(screen.getByTestId("run-all-button")).not.toBeDisabled());
  await user.click(screen.getByTestId("run-all-button"));
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

  it("does not call POST /api/simulate-all until a real tenant is selected and Run is clicked", async () => {
    stubTenantsThen(fetchSpy, jsonResponse({}));
    render(<ReportClient personas={TEST_PERSONAS} />);

    expect(screen.getByTestId("run-all-button")).toBeDisabled();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("/api/tenants"));
    expect(fetchSpy).not.toHaveBeenCalledWith("/api/simulate-all", expect.anything());
  });

  it("clicking Run calls POST /api/simulate-all with the resolved tenantId and vertical", async () => {
    const user = userEvent.setup();
    stubTenantsThen(
      fetchSpy,
      jsonResponse({
        results: [],
        report: buildAllScenariosReport(),
        learningBridge: buildLearningBridgeStatus(),
        promptOverride: buildPromptOverrideStatus(),
      }),
    );
    render(<ReportClient personas={TEST_PERSONAS} />);

    await runAfterTenantResolves(user);

    await waitFor(() => expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument());
    const simulateAllCall = fetchSpy.mock.calls.find(([url]) => url === "/api/simulate-all");
    expect(simulateAllCall).toBeDefined();
    const [, init] = simulateAllCall as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      tenantId: "dss-motor",
      vertical: "AUTOMOTIVE",
    });
  });

  it("renders the report once the run completes", async () => {
    const user = userEvent.setup();
    const body: SimulateAllResponse = {
      results: [buildSimulateAllResultEntry()],
      report: buildAllScenariosReport(),
      learningBridge: buildLearningBridgeStatus(),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await runAfterTenantResolves(user);

    await waitFor(() => expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument());
    expect(screen.getByTestId("all-scenarios-table")).toBeInTheDocument();
    expect(screen.getByTestId("weakest-dimensions-chart")).toBeInTheDocument();
  });

  it("shows an honest SENT status when the aaos-api bridge call succeeds", async () => {
    const user = userEvent.setup();
    const body: SimulateAllResponse = {
      results: [buildSimulateAllResultEntry()],
      report: buildAllScenariosReport(),
      learningBridge: buildLearningBridgeStatus({
        status: "SENT",
        agentRunId: "run-1",
        judgeResultId: "judge-1",
      }),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await runAfterTenantResolves(user);

    await waitFor(() =>
      expect(screen.getByTestId("learning-bridge-status")).toHaveAttribute("data-status", "SENT"),
    );
    expect(screen.getByText(/Terkirim ke Self-Improving System/)).toBeInTheDocument();
  });

  it("shows an honest FAILED status when the aaos-api bridge call fails, without failing the whole report", async () => {
    const user = userEvent.setup();
    const body: SimulateAllResponse = {
      results: [buildSimulateAllResultEntry()],
      report: buildAllScenariosReport(),
      learningBridge: buildLearningBridgeStatus({
        status: "FAILED",
        reason: "aaos-api merespons status 500",
      }),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await runAfterTenantResolves(user);

    await waitFor(() =>
      expect(screen.getByTestId("learning-bridge-status")).toHaveAttribute("data-status", "FAILED"),
    );
    expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument();
  });

  it("renders topPriorities when present", async () => {
    const user = userEvent.setup();
    const body: SimulateAllResponse = {
      results: [],
      report: buildAllScenariosReport({ topPriorities: ["Perbaiki objection handling."] }),
      learningBridge: buildLearningBridgeStatus(),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await runAfterTenantResolves(user);
    await waitFor(() => expect(screen.getByTestId("top-priorities")).toBeInTheDocument());
    expect(screen.getByText("Perbaiki objection handling.")).toBeInTheDocument();
  });

  it("shows an ErrorCard when the API responds with an error envelope", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorResponse = {
      error: { code: "INTERNAL", message: "Gagal menjalankan simulasi." },
    };
    stubTenantsThen(fetchSpy, jsonResponse(errorBody, false));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await runAfterTenantResolves(user);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText("Gagal menjalankan simulasi.")).toBeInTheDocument();
  });

  it("allows approving Clara for deploy once the report has loaded (local state only, no extra fetch)", async () => {
    const user = userEvent.setup();
    const body: SimulateAllResponse = {
      results: [buildSimulateAllResultEntry()],
      report: buildAllScenariosReport({ overallVerdict: Verdict.APPROVE }),
      learningBridge: buildLearningBridgeStatus(),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(body));

    render(<ReportClient personas={TEST_PERSONAS} />);
    await runAfterTenantResolves(user);
    await waitFor(() => expect(screen.getByTestId("approve-button")).toBeInTheDocument());

    const callsBeforeApprove = fetchSpy.mock.calls.length;
    await user.click(screen.getByTestId("approve-button"));
    expect(screen.getByTestId("approve-confirmation")).toBeInTheDocument();
    // Approving never calls fetch again.
    expect(fetchSpy).toHaveBeenCalledTimes(callsBeforeApprove);
  });
});
