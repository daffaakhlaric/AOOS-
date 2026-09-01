import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LearningMonitorClient } from "@/components/learning/LearningMonitorClient";

/**
 * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — real, minimal component test for
 * `LearningMonitorClient.tsx`'s new LIVE-run display branch (`agentRunId` populated vs.
 * `simulationId`). No prior test file existed for this component before this phase (verified: no
 * `tests/components/learning/` directory existed in this repo) — this establishes the first real
 * coverage for it, mirroring `tests/components/activity/ActivityLogClient.test.tsx`'s own
 * `mockFetch`-by-URL-substring pattern, this app's closest real precedent for a "list of AI-driven
 * records" client component test.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const SIMULATION_PROPOSAL = {
  id: "proposal-sim-1",
  tenantId: "dss-motor",
  simulationId: "sim-1",
  agentRunId: null,
  agent: "SAMANTHA",
  analysis: "Analisa simulasi.",
  gaps: {
    source: "SIMULATION",
    samanthaCoverageScore: 50,
    kaiScore: 80,
    claraScore: 60,
    overallScore: 58,
    grade: "D",
    verdict: "NO-GO",
    feedbackItems: [],
  },
  improvements: [],
  status: "PENDING",
  decidedBy: null,
  decisionNotes: null,
  decidedAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
};

const LIVE_RUN_PROPOSAL = {
  id: "proposal-live-1",
  tenantId: "dss-motor",
  simulationId: null,
  agentRunId: "agent-run-42",
  agent: "CLARA",
  analysis: "Analisa run live Clara.",
  gaps: {
    source: "LIVE_RUN",
    agent: "CLARA",
    overallScore: 45,
    scores: { outcome_completeness: 40, commission_plausibility: 50 },
    trend: "DECLINING",
    feedbackItems: [
      { dimension: "outcome_completeness", message: "Closing record tidak lengkap." },
    ],
  },
  improvements: [],
  status: "PENDING",
  decidedBy: null,
  decisionNotes: null,
  decidedAt: null,
  createdAt: "2026-09-02T09:00:00.000Z",
};

function mockFetch(proposals: readonly unknown[]): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/learning/proposals")) {
      return jsonResponse(proposals);
    }
    if (url.includes("/api/learning/prompt-overrides")) {
      return jsonResponse([]);
    }
    return jsonResponse({}, 404);
  }) as unknown as typeof fetch;
}

describe("LearningMonitorClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a real LIVE-run-triggered proposal with a LIVE RUN badge and its real agentRunId/judge score/trend, not a simulation gap summary", async () => {
    mockFetch([LIVE_RUN_PROPOSAL]);
    render(<LearningMonitorClient />);

    await waitFor(() => expect(screen.getByText("LIVE RUN")).toBeInTheDocument());
    expect(screen.getByText(/Agent Run: agent-run-42/)).toBeInTheDocument();
    expect(screen.getByText(/Judge Score: 45/)).toBeInTheDocument();
    expect(screen.getByText(/Trend: DECLINING/)).toBeInTheDocument();
    // The simulation-shaped fields must NOT be rendered for a LIVE_RUN-triggered card.
    expect(screen.queryByText(/Samantha:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Grade:/)).not.toBeInTheDocument();
  });

  it("renders a real simulation-triggered proposal with the original gap summary and no LIVE RUN badge", async () => {
    mockFetch([SIMULATION_PROPOSAL]);
    render(<LearningMonitorClient />);

    await waitFor(() => expect(screen.getByText(/NO-GO/)).toBeInTheDocument());
    expect(screen.queryByText("LIVE RUN")).not.toBeInTheDocument();
    expect(screen.getByText(/Overall: 58/)).toBeInTheDocument();
    expect(screen.getByText(/Samantha: 50/)).toBeInTheDocument();
    expect(screen.getByText(/Grade: D/)).toBeInTheDocument();
  });
});
