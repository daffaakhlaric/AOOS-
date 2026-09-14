import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuditClient } from "@/components/meta-ads/AuditClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function metrics(overrides: Partial<AdAccountSummaryDto["totals"]> = {}) {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.0,
    conversations: 40,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 8,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

const CAMPAIGNS_BODY: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [
    {
      id: "c1",
      metaId: "c1",
      stableId: "#A001",
      name: "Meta-DM-Leads-Mobix",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 1_000_000,
      dailyBudget: 0,
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 1_000_000,
          dailyBudget: 500_000,
          ads: [
            {
              id: "ad-1",
              metaId: "ad-1",
              stableId: "#C001",
              name: "Ad DM Bintaro",
              status: "ACTIVE",
              funnel: "DM",
              branch: "BINTARO",
              verdict: "REVIEW",
              metrics: metrics({ spend: 1_000_000, conversations: 40 }),
              daysSinceCreation: 3,
            },
          ],
        },
      ],
    },
    {
      id: "c2",
      metaId: "c2",
      stableId: "#A002",
      name: "Meta-Engagement-Boost",
      objective: "OUTCOME_ENGAGEMENT",
      status: "ACTIVE",
      spend: 500_000,
      dailyBudget: 0,
      adSets: [
        {
          id: "as2",
          metaId: "as2",
          stableId: "#B002",
          name: "AdSet 2",
          status: "ACTIVE",
          spend: 500_000,
          dailyBudget: 300_000,
          ads: [
            {
              id: "ad-2",
              metaId: "ad-2",
              stableId: "#C002",
              name: "Ad Boost Cinere",
              status: "ACTIVE",
              funnel: "BRAND_BOOST",
              branch: "CINERE",
              verdict: "FIX",
              // High frequency + expensive Rp/chat, and wrong objective (not OUTCOME_LEADS).
              metrics: metrics({ spend: 500_000, conversations: 5, frequency: 4.2 }),
            },
          ],
        },
      ],
    },
  ],
  ads: [
    {
      id: "ad-1",
      metaId: "ad-1",
      stableId: "#C001",
      name: "Ad DM Bintaro",
      campaignName: "Meta-DM-Leads-Mobix",
      status: "ACTIVE",
      funnel: "DM",
      branch: "BINTARO",
      verdict: "REVIEW",
      metrics: metrics({ spend: 1_000_000, conversations: 40 }),
      daysSinceCreation: 3,
    },
    {
      id: "ad-2",
      metaId: "ad-2",
      stableId: "#C002",
      name: "Ad Boost Cinere",
      campaignName: "Meta-Engagement-Boost",
      status: "ACTIVE",
      funnel: "BRAND_BOOST",
      branch: "CINERE",
      verdict: "FIX",
      metrics: metrics({ spend: 500_000, conversations: 5, frequency: 4.2 }),
    },
  ],
  totals: metrics({ spend: 1_500_000, conversations: 45 }),
  campaignCount: 2,
  adCount: 2,
};

describe("AuditClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state prompting a pull from Data Iklan when there is no cache", async () => {
    render(<AuditClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(
      screen.getByText(/Tarik data di halaman Data Iklan terlebih dahulu/),
    ).toBeInTheDocument();
  });

  it("reads the shared campaignsCache on mount — no network call", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    const fetchMock = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AuditClient />);

    expect(await screen.findByTestId("audit-kpi-bar")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("groups spend by the real ad.funnel field (Brand/Boost + DM Multi-channel labels)", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const funnelSection = await screen.findByTestId("audit-funnel-section");
    expect(funnelSection.textContent).toContain("DM Multi-channel");
    expect(funnelSection.textContent).toContain("Brand/Boost");
  });

  it("groups spend by the real ad.branch field (BINTARO, CINERE — no Pondok Bambu)", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const branchSection = await screen.findByTestId("audit-branch-section");
    expect(branchSection.textContent).toContain("BINTARO");
    expect(branchSection.textContent).toContain("CINERE");
    expect(branchSection.textContent).not.toContain("Pondok");
  });

  it("flags the OUTCOME_ENGAGEMENT campaign's ad under 'salah tujuan' but not the OUTCOME_LEADS one", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const wasteSection = await screen.findByTestId("audit-waste-section");
    expect(wasteSection.textContent).toContain("Ad Boost Cinere");
    expect(wasteSection.textContent?.indexOf("Ad Boost Cinere")).toBeGreaterThan(-1);
  });

  it("flags the ad with frequency >= 3.5 under 'audiens jenuh'", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const wasteSection = await screen.findByTestId("audit-waste-section");
    expect(wasteSection.textContent).toContain("frequency 4.2");
  });

  it("flags the ad with Rp/chat > 25.000 under 'terlalu mahal'", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    // Ad Boost Cinere: 500_000 / 5 = Rp 100.000/chat, well above the 25.000 threshold.
    const wasteSection = await screen.findByTestId("audit-waste-section");
    expect(wasteSection.textContent).toContain("Rp 100.000");
  });

  it("lists ads created within the last 14 days under 'Iklan Baru'", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const newAdsSection = await screen.findByTestId("audit-new-ads-section");
    expect(newAdsSection.textContent).toContain("Ad DM Bintaro");
    // Ad Boost Cinere has no daysSinceCreation — must not appear as a "new" ad.
    expect(newAdsSection.textContent).not.toContain("Ad Boost Cinere");
  });

  it("force-pulls fresh data via /api/campaigns when 'Tarik data baru' is clicked", async () => {
    const fetchMock = vi.fn(async (_input: string) => jsonResponse(CAMPAIGNS_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<AuditClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/i }));
    await waitFor(() => expect(screen.getByTestId("audit-kpi-bar")).toBeInTheDocument());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/campaigns");
  });

  it("shows the real verdict badge (FIX) on a 'salah tujuan' row — never a hardcoded label", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const wasteSection = await screen.findByTestId("audit-waste-section");
    // "Ad Boost Cinere" carries the real verdict "FIX" in the fixture (objective !=
    // OUTCOME_LEADS always produces FIX, VerdictEngine.ts's own top-priority rule).
    const badges = within(wasteSection).getAllByTestId("verdict-badge");
    expect(badges.some((badge) => badge.textContent?.includes("FIX"))).toBe(true);
  });

  it("colors the Rp/Chat KPI amber once the account-wide average crosses Rp 25.000", async () => {
    const expensiveBody: AdAccountSummaryDto = {
      ...CAMPAIGNS_BODY,
      totals: metrics({ spend: 3_000_000, conversations: 10 }), // Rp 300.000/chat
    };
    writeCampaignsCache({ data: expensiveBody, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const kpiBar = await screen.findByTestId("audit-kpi-bar");
    expect(within(kpiBar).getByText("Rp 300.000").className).toContain("kpiValueAmber");
  });

  it("caps 'salah tujuan' rows at 5 shown, with a '+ N lainnya' row for the rest", async () => {
    const manyAds = Array.from({ length: 7 }, (_, i) => ({
      id: `ad-wrong-${i}`,
      metaId: `ad-wrong-${i}`,
      stableId: `#C10${i}`,
      name: `Ad Salah Tujuan ${i}`,
      campaignName: "Meta-Engagement-Boost",
      status: "ACTIVE",
      funnel: "BRAND_BOOST",
      branch: "CINERE",
      verdict: "FIX",
      metrics: metrics({ spend: 100_000, conversations: 10 }),
    }));
    const manyBody: AdAccountSummaryDto = {
      ...CAMPAIGNS_BODY,
      campaigns: [
        {
          ...CAMPAIGNS_BODY.campaigns[1]!,
          adSets: [{ ...CAMPAIGNS_BODY.campaigns[1]!.adSets[0]!, ads: manyAds }],
        },
      ],
      ads: manyAds,
    };
    writeCampaignsCache({ data: manyBody, fetchedAt: Date.now(), period: "last_30d" });
    render(<AuditClient />);

    const wasteSection = await screen.findByTestId("audit-waste-section");
    expect(wasteSection.textContent).toContain("+ 2 lainnya");
    expect(wasteSection.textContent).not.toContain("Ad Salah Tujuan 6");
  });
});
