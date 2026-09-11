import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignAdDrillDown } from "@/components/campaigns/CampaignAdDrillDown";
import type { AdMetricsDto, AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

function metrics(overrides: Partial<AdMetricsDto> = {}): AdMetricsDto {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.0,
    conversations: 5,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 10,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

function ad(overrides: Partial<AdSummaryDto> = {}): AdSummaryDto {
  return {
    id: "ad-1",
    stableId: "#C001",
    name: "Ad 1",
    status: "ACTIVE",
    funnel: "DM",
    branch: "BINTARO",
    verdict: "PAUSE",
    metrics: metrics(),
    primaryText: "Xpander diskon besar bulan ini",
    headline: "Promo Xpander",
    description: "Test drive gratis",
    ...overrides,
  };
}

function campaign(overrides: Partial<CampaignSummaryDto> = {}): CampaignSummaryDto {
  return {
    id: "camp-1",
    stableId: "#A001",
    name: "Xpander Bintaro",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 1_000_000,
    adSets: [
      {
        id: "as1",
        stableId: "#B001",
        name: "AdSet 1",
        status: "ACTIVE",
        spend: 1_000_000,
        learningStatus: "LEARNING",
        ads: [ad()],
      },
    ],
    ...overrides,
  };
}

function mockFetchOnce(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("CampaignAdDrillDown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real ad-set hierarchy, collapsed by default", () => {
    render(<CampaignAdDrillDown campaign={campaign()} />);
    expect(screen.getByTestId("ad-drilldown")).toBeInTheDocument();
    expect(screen.getByTestId("open-adset-as1")).toBeInTheDocument();
    expect(screen.queryByTestId("ad-row-ad-1")).not.toBeInTheDocument();
  });

  it("expands an ad set on click to reveal its real ads, and shows the Learning Phase badge inherited from the adset", async () => {
    const user = userEvent.setup();
    render(<CampaignAdDrillDown campaign={campaign()} />);

    expect(screen.getByTestId("learning-badge-adset-as1")).toHaveTextContent("Learning");

    await user.click(screen.getByTestId("open-adset-as1"));
    expect(screen.getByTestId("ad-row-ad-1")).toBeInTheDocument();
    expect(screen.getByTestId("diagnose-button-ad-1")).toBeInTheDocument();
  });

  it("honest empty state when a campaign has no ad sets", () => {
    render(<CampaignAdDrillDown campaign={campaign({ adSets: [] })} />);
    expect(screen.getByTestId("ad-drilldown-empty")).toBeInTheDocument();
  });

  it("Diagnosa Samantha button calls /api/ads/diagnose-copy with the real ad's copy/verdict/metrics and renders the structural + Pain/Offer/USP result", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({
      available: true,
      structural: {
        hook: { status: "YES", reasoning: "Ada hook kuat di awal." },
        clearProblem: { status: "PARTIAL", reasoning: "Masalah disebut tapi kurang spesifik." },
        toThePoint: { status: "YES", reasoning: "Copy singkat dan langsung." },
        softCta: { status: "NO", reasoning: "Tidak ada CTA yang jelas." },
      },
      diagnosis: { issue: "OFFER", reasoning: "Offer generik, tidak ada urgensi." },
      learningPhaseNote: "Ad set masih Learning Phase, evaluasi belum akurat.",
    });

    render(<CampaignAdDrillDown campaign={campaign()} />);
    await user.click(screen.getByTestId("open-adset-as1"));
    await user.click(screen.getByTestId("diagnose-button-ad-1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/ads/diagnose-copy");
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
    expect(body["adName"]).toBe("Ad 1");
    expect(body["primaryText"]).toBe("Xpander diskon besar bulan ini");
    expect(body["verdict"]).toBe("PAUSE");
    expect(body["isUnderperforming"]).toBe(true);
    expect(body["spend"]).toBe(1_000_000);
    expect(body["conversations"]).toBe(5);
    expect(body["rphChatIDR"]).toBe(200_000);
    expect(body["learningStatus"]).toBe("LEARNING");

    await waitFor(() => expect(screen.getByTestId("diagnosis-result-ad-1")).toBeInTheDocument());
    expect(screen.getByTestId("diagnosis-result-ad-1")).toHaveTextContent("Hook: YA");
    expect(screen.getByTestId("diagnosis-result-ad-1")).toHaveTextContent("Soft CTA: TIDAK");
    expect(screen.getByTestId("diagnosis-issue-ad-1")).toHaveTextContent("Offer kurang menarik");
    expect(screen.getByTestId("diagnosis-learning-note-ad-1")).toHaveTextContent(
      "Ad set masih Learning Phase",
    );
  });

  it("honest degrade: renders the real NO_COPY_TEXT message, never a fabricated diagnosis, when the ad's creative carries no usable copy text", async () => {
    const user = userEvent.setup();
    mockFetchOnce({
      available: false,
      reason: "NO_COPY_TEXT",
      message: "Teks iklan tidak tersedia dari Meta untuk tipe creative ini, tidak bisa dianalisis",
    });

    render(
      <CampaignAdDrillDown
        campaign={campaign({
          adSets: [
            {
              id: "as1",
              stableId: "#B001",
              name: "AdSet 1",
              status: "ACTIVE",
              spend: 1_000_000,
              ads: [ad({ primaryText: undefined, headline: undefined, description: undefined })],
            },
          ],
        })}
      />,
    );
    await user.click(screen.getByTestId("open-adset-as1"));
    await user.click(screen.getByTestId("diagnose-button-ad-1"));

    await waitFor(() =>
      expect(screen.getByTestId("diagnosis-unavailable-ad-1")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("diagnosis-unavailable-ad-1")).toHaveTextContent(
      "Teks iklan tidak tersedia",
    );
  });

  it("honest degrade: shows a real error message (never fabricated data) when the proxy call itself fails", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ message: "boom" }, 500);

    render(<CampaignAdDrillDown campaign={campaign()} />);
    await user.click(screen.getByTestId("open-adset-as1"));
    await user.click(screen.getByTestId("diagnose-button-ad-1"));

    await waitFor(() =>
      expect(screen.getByTestId("diagnosis-unavailable-ad-1")).toBeInTheDocument(),
    );
  });
});
