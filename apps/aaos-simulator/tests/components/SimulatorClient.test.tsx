import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SimulatorClient } from "@/components/simulator/SimulatorClient";
import type { ApiErrorResponse, SimulateResponse } from "@/types/simulator.types";

import {
  buildJudgementResult,
  buildPromptOverrideStatus,
  buildSimulationResult,
  TEST_PERSONAS,
} from "../fixtures";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Stubs `GET /api/tenants` to resolve with one real AUTOMOTIVE tenant, matching every other real fetch call's `(url, init?)` signature — routes calls by URL so `POST /api/simulate` can be asserted on separately. */
function stubTenantsThen(fetchSpy: ReturnType<typeof vi.fn>, simulateResponse: Response): void {
  fetchSpy.mockImplementation((url: string) => {
    if (url === "/api/tenants") {
      return Promise.resolve(
        jsonResponse({
          ok: true,
          tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
        }),
      );
    }
    return Promise.resolve(simulateResponse);
  });
}

describe("SimulatorClient", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Run is disabled until the real tenant selector resolves a tenant", async () => {
    stubTenantsThen(fetchSpy, jsonResponse({}));
    render(<SimulatorClient personas={TEST_PERSONAS} />);

    expect(screen.getByTestId("run-button")).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId("run-button")).not.toBeDisabled());
  });

  it("selecting a persona then clicking Run calls POST /api/simulate with personaId, the resolved tenantId, and vertical", async () => {
    const user = userEvent.setup();
    const successBody: SimulateResponse = {
      simulationResult: buildSimulationResult(),
      judgementResult: buildJudgementResult(),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(successBody));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("run-button")).not.toBeDisabled());
    await user.click(screen.getByText("Cold Buyer"));
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const simulateCall = fetchSpy.mock.calls.find(([url]) => url === "/api/simulate");
    expect(simulateCall).toBeDefined();
    const [, init] = simulateCall as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      personaId: "cold_buyer",
      tenantId: "dss-motor",
      vertical: "AUTOMOTIVE",
    });
  });

  it("renders the conversation and score panel once the run succeeds", async () => {
    const user = userEvent.setup();
    const successBody: SimulateResponse = {
      simulationResult: buildSimulationResult(),
      judgementResult: buildJudgementResult(),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(successBody));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("run-button")).not.toBeDisabled());
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(screen.getByTestId("conversation-view")).toBeInTheDocument());
    expect(screen.getByTestId("score-panel")).toBeInTheDocument();
  });

  it("shows an ErrorCard when the API responds with an error envelope", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorResponse = {
      error: { code: "VALIDATION_ERROR", message: "Persona tidak valid." },
    };
    stubTenantsThen(fetchSpy, jsonResponse(errorBody, false));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("run-button")).not.toBeDisabled());
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText("Persona tidak valid.")).toBeInTheDocument();
  });

  it("shows an ErrorCard when fetch itself rejects (network failure)", async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation((url: string) => {
      if (url === "/api/tenants") {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
          }),
        );
      }
      return Promise.reject(new Error("network down"));
    });

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await waitFor(() => expect(screen.getByTestId("run-button")).not.toBeDisabled());
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("Approve Clara is disabled until a run has completed, then approves locally without another fetch call", async () => {
    const user = userEvent.setup();
    const successBody: SimulateResponse = {
      simulationResult: buildSimulationResult(),
      judgementResult: buildJudgementResult(),
      promptOverride: buildPromptOverrideStatus(),
    };
    stubTenantsThen(fetchSpy, jsonResponse(successBody));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    expect(screen.getByTestId("approve-button")).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId("run-button")).not.toBeDisabled());

    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => expect(screen.getByTestId("approve-button")).not.toBeDisabled());

    await user.click(screen.getByTestId("approve-button"));
    expect(screen.getByTestId("approve-confirmation")).toBeInTheDocument();
    // The /api/tenants selector fetch, plus the one /api/simulate call from Run — approving never calls fetch again.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
