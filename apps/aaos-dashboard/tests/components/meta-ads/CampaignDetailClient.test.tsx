import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignDetailClient } from "@/components/meta-ads/CampaignDetailClient";

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

describe("CampaignDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the found ad's detail", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    render(<CampaignDetailClient campaignId="ad-1" />);
    await waitFor(() => expect(screen.getByText("#A001")).toBeInTheDocument());
    expect(screen.getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument();
  });

  it("shows an empty state when the ad id is not found", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    render(<CampaignDetailClient campaignId="missing" />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<CampaignDetailClient campaignId="ad-1" />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
