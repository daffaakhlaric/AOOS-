import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomationPanel } from "@/components/campaigns/AutomationPanel";

function mockFetch(
  routes: Record<string, { readonly body: unknown; readonly status?: number }>,
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const matchKey = Object.keys(routes).find((key) => url === key || url.startsWith(key));
    if (matchKey === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    const route = routes[matchKey];
    if (route === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as unknown as typeof fetch;
}

const RESPONSE_WITH_PLAN = {
  campaignId: "camp-1",
  health: {
    delivery: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
    costEfficiency: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
    creative: { status: "CRITICAL", score: 20, confidence: 0.9, issues: ["Frequency tinggi."] },
    audience: { status: "UNKNOWN", confidence: 0, issues: [] },
    conversion: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
    tracking: { status: "UNKNOWN", confidence: 0, issues: [] },
    leadQuality: { status: "UNKNOWN", confidence: 0, issues: [] },
    overallStatus: "CRITICAL",
  },
  diagnosis: {
    rootCause: "CREATIVE_FATIGUE",
    confidence: 0.9,
    impact: "HIGH",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: ["creative"],
  },
  decision: {
    decision: "REQUEST_KAI_CREATIVE",
    primaryDiagnosis: "CREATIVE_FATIGUE",
    confidence: 0.9,
    impact: "HIGH",
    reason: "Root cause CREATIVE_FATIGUE terdeteksi.",
    riskOfDoingNothing: "CTR terus menurun.",
    expectedOutcome: "CTR pulih.",
    monitoringPlan: {
      reviewAfterHours: 48,
      successConditions: ["Dimensi creative kembali HEALTHY."],
      rollbackConditions: ["Creative baru tidak memperbaiki dimensi creative."],
    },
  },
};

describe("AutomationPanel (EYVRA Samantha V2 + Kai V2 Phase 51 — PROMPT 79)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real monitoringPlan.reviewAfterHours/successConditions/rollbackConditions from GET /api/campaign-health/:campaignId", async () => {
    mockFetch({ "/api/campaign-health/camp-1": { body: RESPONSE_WITH_PLAN } });
    render(<AutomationPanel campaignId="camp-1" campaignName="Test Campaign" />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-next-review")).toHaveTextContent("48 jam"),
    );
    expect(screen.getByTestId("automation-success-conditions")).toHaveTextContent(
      "Dimensi creative kembali HEALTHY.",
    );
    expect(screen.getByTestId("automation-rollback-conditions")).toHaveTextContent(
      "Creative baru tidak memperbaiki dimensi creative.",
    );
  });

  it("honestly labels Mode as unavailable — no real autopilot/guardrail-mode system exists in this codebase", async () => {
    mockFetch({ "/api/campaign-health/camp-1": { body: RESPONSE_WITH_PLAN } });
    render(<AutomationPanel campaignId="camp-1" campaignName="Test Campaign" />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-mode")).toHaveTextContent("Belum tersedia"),
    );
  });

  it("shows an honest error state when the fetch fails", async () => {
    mockFetch({ "/api/campaign-health/camp-1": { body: {}, status: 500 } });
    render(<AutomationPanel campaignId="camp-1" campaignName="Test Campaign" />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-panel")).toHaveTextContent(
        "Gagal memuat Automation panel.",
      ),
    );
  });

  it("re-fetches when campaignId changes", async () => {
    const fetchMock = mockFetch2({ "/api/campaign-health/camp-1": RESPONSE_WITH_PLAN });
    const { rerender } = render(<AutomationPanel campaignId="camp-1" campaignName="A" />);
    await waitFor(() => expect(screen.getByTestId("automation-next-review")).toBeInTheDocument());
    rerender(<AutomationPanel campaignId="camp-2" campaignName="B" />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/campaign-health/camp-2"),
      ),
    );
  });
});

function mockFetch2(routes: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const matchKey = Object.keys(routes).find((key) => url === key || url.startsWith(key));
    if (matchKey === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    return new Response(JSON.stringify(routes[matchKey]), { status: 200 });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
