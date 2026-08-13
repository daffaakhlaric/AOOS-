import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetaAdsClient } from "@/components/meta-ads/MetaAdsClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const CAMPAIGNS_BODY = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  ads: [
    {
      id: "ad-1",
      name: "#A001",
      campaignName: "Meta-DM-Leads-Mobix",
      status: "ACTIVE",
      funnel: "DM",
      branch: "BINTARO",
      verdict: "REVIEW",
      metrics: {
        spend: 6_000_000,
        conversations: 790,
        d2: 400,
        d3: 307,
        d5: 100,
        leadForm: 20,
        totalLead: 320,
        rphD3: 19_541,
      },
    },
  ],
  totals: {
    spend: 6_000_000,
    conversations: 790,
    d2: 400,
    d3: 307,
    d5: 100,
    leadForm: 20,
    totalLead: 320,
    rphD3: null,
  },
};

describe("MetaAdsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the metrics summary + campaign table once data loads", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await waitFor(() => expect(screen.getByText("#A001")).toBeInTheDocument());
    expect(screen.getByTestId("metrics-summary-bar")).toBeInTheDocument();
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("re-fetches with the new datePreset when the selector changes", async () => {
    const fetchMock = vi.fn(async (_input: string) => jsonResponse(CAMPAIGNS_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await waitFor(() => expect(screen.getByText("#A001")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText("Periode"), "last_7d");
    await waitFor(() => {
      const calledWithNewPreset = fetchMock.mock.calls.some(([url]) =>
        String(url).includes("datePreset=last_7d"),
      );
      expect(calledWithNewPreset).toBe(true);
    });
  });

  it("posts to /api/verdicts and re-fetches when Execute is clicked", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/verdicts")) return jsonResponse({ action: "PAUSED" });
      return jsonResponse(CAMPAIGNS_BODY);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await waitFor(() => expect(screen.getByText("#A001")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Execute/ }));
    await waitFor(() => {
      const calledVerdicts = fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/verdicts"),
      );
      expect(calledVerdicts).toBe(true);
    });
  });
});
