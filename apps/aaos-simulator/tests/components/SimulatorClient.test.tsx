import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SimulatorClient } from "@/components/simulator/SimulatorClient";
import type { ApiErrorResponse, SimulateResponse } from "@/types/simulator.types";

import { buildJudgementResult, buildSimulationResult, TEST_PERSONAS } from "../fixtures";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
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

  it("selecting a persona then clicking Run calls POST /api/simulate with that personaId", async () => {
    const user = userEvent.setup();
    const successBody: SimulateResponse = {
      simulationResult: buildSimulationResult(),
      judgementResult: buildJudgementResult(),
    };
    fetchSpy.mockResolvedValue(jsonResponse(successBody));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await user.click(screen.getByText("Cold Buyer"));
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/simulate");
    expect(JSON.parse(init.body as string)).toEqual({ personaId: "cold_buyer" });
  });

  it("renders the conversation and score panel once the run succeeds", async () => {
    const user = userEvent.setup();
    const successBody: SimulateResponse = {
      simulationResult: buildSimulationResult(),
      judgementResult: buildJudgementResult(),
    };
    fetchSpy.mockResolvedValue(jsonResponse(successBody));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(screen.getByTestId("conversation-view")).toBeInTheDocument());
    expect(screen.getByTestId("score-panel")).toBeInTheDocument();
  });

  it("shows an ErrorCard when the API responds with an error envelope", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorResponse = {
      error: { code: "VALIDATION_ERROR", message: "Persona tidak valid." },
    };
    fetchSpy.mockResolvedValue(jsonResponse(errorBody, false));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText("Persona tidak valid.")).toBeInTheDocument();
  });

  it("shows an ErrorCard when fetch itself rejects (network failure)", async () => {
    const user = userEvent.setup();
    fetchSpy.mockRejectedValue(new Error("network down"));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("Approve Jessy is disabled until a run has completed, then approves locally without another fetch call", async () => {
    const user = userEvent.setup();
    const successBody: SimulateResponse = {
      simulationResult: buildSimulationResult(),
      judgementResult: buildJudgementResult(),
    };
    fetchSpy.mockResolvedValue(jsonResponse(successBody));

    render(<SimulatorClient personas={TEST_PERSONAS} />);
    expect(screen.getByTestId("approve-button")).toBeDisabled();

    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => expect(screen.getByTestId("approve-button")).not.toBeDisabled());

    await user.click(screen.getByTestId("approve-button"));
    expect(screen.getByTestId("approve-confirmation")).toBeInTheDocument();
    // Only the one /api/simulate call from Run — approving never calls fetch again.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
