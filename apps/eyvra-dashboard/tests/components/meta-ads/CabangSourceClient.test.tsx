import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CabangSourceClient } from "@/components/meta-ads/CabangSourceClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto, CampaignAdDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function metrics(overrides: Partial<CampaignAdDto["metrics"]> = {}): CampaignAdDto["metrics"] {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.0,
    conversations: 40,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 17,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

function buildAd(overrides: Partial<CampaignAdDto> = {}): CampaignAdDto {
  return {
    id: "ad-1",
    stableId: "#C001",
    name: "Ad 1",
    campaignName: "SUV Premium — Lookalike",
    status: "ACTIVE",
    funnel: "DM",
    branch: "CINERE",
    verdict: "REVIEW",
    metrics: metrics(),
    ...overrides,
  };
}

const CINERE_AD = buildAd({
  id: "ad-1",
  branch: "CINERE",
  campaignName: "SUV Premium — Lookalike",
  metrics: metrics({ spend: 3_000_000, totalLead: 30, conversations: 60 }),
});
const BANDUNG_AD = buildAd({
  id: "ad-2",
  branch: "BANDUNG",
  campaignName: "Motor Baru — Prospecting",
  metrics: metrics({ spend: 2_000_000, totalLead: 20, conversations: 40 }),
});
const MULTI_AD = buildAd({
  id: "ad-3",
  branch: "MULTI",
  campaignName: "Boost Konten Harian",
  metrics: metrics({ spend: 500_000, totalLead: 5, conversations: 10 }),
});
const UMUM_AD = buildAd({
  id: "ad-4",
  branch: "UMUM",
  campaignName: "Awareness Reels",
  metrics: metrics({ spend: 100_000, totalLead: 1, conversations: 2 }),
});

const CAMPAIGNS_BODY: AdAccountSummaryDto = {
  id: "act_1",
  name: "DSS Motor",
  syncedAt: "2026-08-17T01:07:05.000Z",
  campaigns: [],
  ads: [CINERE_AD, BANDUNG_AD, MULTI_AD, UMUM_AD],
  totals: metrics({
    spend: 5_600_000,
    totalLead: 56,
    conversations: 112,
    d3: 30,
    d5: 15,
    leadForm: 11,
  }),
  campaignCount: 0,
  adCount: 4,
};

function mockFetchSingleAccount(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/api/meta-ads-accounts")) {
      return jsonResponse([{ id: "act_1", name: "DSS Motor" }]);
    }
    return jsonResponse(CAMPAIGNS_BODY);
  });
}

describe("CabangSourceClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when there is no cache — embedded at the top of MetaAdsClient.tsx's own page, which already shows its own loading/error/'Belum ada data' state for the whole page in that case", async () => {
    global.fetch = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    const { container } = render(<CabangSourceClient />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("reads the shared campaignsCache on mount — never calls /api/campaigns", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    const fetchMock = mockFetchSingleAccount();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CabangSourceClient />);

    expect(await screen.findByTestId("cabang-source-kpi-strip")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/campaigns"))).toBe(
      false,
    );
  });

  it("renders the real KPI strip totals (Belanja/Total Lead/Rp per Lead/Chat/D3-D5-Form)", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = mockFetchSingleAccount() as unknown as typeof fetch;

    render(<CabangSourceClient />);

    const kpi = await screen.findByTestId("cabang-source-kpi-strip");
    // 3_000_000 + 2_000_000 + 500_000 + 100_000 = 5_600_000 -> "Rp 5,6 jt"
    expect(kpi.textContent).toContain("Rp 5,6 jt");
    // totalLead = 30+20+5+1 = 56
    expect(kpi.textContent).toContain("56");
    // chat = 60+40+10+2 = 112
    expect(kpi.textContent).toContain("112");
  });

  it("groups Per Cabang by ad.branch — Cinere/Bandung named, MULTI+UMUM folded into 'Multi / Boost'", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = mockFetchSingleAccount() as unknown as typeof fetch;

    render(<CabangSourceClient />);

    const section = await screen.findByTestId("cabang-source-per-cabang");
    expect(section.textContent).toContain("Cinere");
    expect(section.textContent).toContain("Bandung");
    expect(section.textContent).toContain("Multi / Boost");
    // Bintaro has no ads in this fixture — must not be fabricated as a table ROW (the caption's
    // own explanatory text legitimately mentions "Bintaro" by name, so assert on the table body,
    // not the whole section).
    const table = section.querySelector("tbody");
    expect(table?.textContent ?? "").not.toContain("Bintaro");
  });

  it("lists Top Campaign sorted by spend descending", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = mockFetchSingleAccount() as unknown as typeof fetch;

    render(<CabangSourceClient />);

    const section = await screen.findByTestId("cabang-source-top-campaign");
    const text = section.textContent ?? "";
    expect(text.indexOf("SUV Premium")).toBeLessThan(text.indexOf("Motor Baru"));
    expect(text.indexOf("Motor Baru")).toBeLessThan(text.indexOf("Boost Konten Harian"));
  });

  it("shows an honest 'Belum tersedia' empty state for Per Source and Cabang × Source — no fabricated numbers", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = mockFetchSingleAccount() as unknown as typeof fetch;

    render(<CabangSourceClient />);

    // Naming the platforms in the "not yet available" explanation is fine and expected — what
    // must never appear is an actual DATA TABLE (a `<table>`/spend-lead row) for them.
    const perSource = await screen.findByTestId("cabang-source-per-source");
    expect(perSource.textContent).toContain("Belum tersedia");
    expect(perSource.querySelector("table")).toBeNull();

    const cross = await screen.findByTestId("cabang-source-cross");
    expect(cross.textContent).toContain("Belum tersedia");
    expect(cross.querySelector("table")).toBeNull();
  });

  it("shows the footer with the real fetchedAt/period, no fabricated date range", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = mockFetchSingleAccount() as unknown as typeof fetch;

    render(<CabangSourceClient />);

    const footer = await screen.findByTestId("cabang-source-footer");
    expect(footer.textContent).toContain("Ditarik:");
    expect(footer.textContent).toContain("last_30d");
  });

  it("does not render the multi-account pill selector when only 1 account is configured", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = mockFetchSingleAccount() as unknown as typeof fetch;

    render(<CabangSourceClient />);
    await screen.findByTestId("cabang-source-kpi-strip");
    expect(screen.queryByTestId("account-pills")).not.toBeInTheDocument();
  });

  it("renders account pills and merges 'Semua Akun' ad totals across accounts when >1 account is configured", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    const OTHER_ACCOUNT_BODY: AdAccountSummaryDto = {
      ...CAMPAIGNS_BODY,
      id: "act_2",
      name: "Pusat Grosir Mobil",
      ads: [
        buildAd({
          id: "ad-other-1",
          branch: "CINERE",
          campaignName: "Mobil Keluarga — Prospecting",
          metrics: metrics({ spend: 1_000_000, totalLead: 10, conversations: 20 }),
        }),
      ],
      totals: metrics({ spend: 1_000_000, totalLead: 10, conversations: 20 }),
    };
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/meta-ads-accounts")) {
        return jsonResponse([
          { id: "act_1", name: "DSS Motor" },
          { id: "act_2", name: "Pusat Grosir Mobil" },
        ]);
      }
      if (url.includes("adAccountId=act_2")) {
        return jsonResponse(OTHER_ACCOUNT_BODY);
      }
      return jsonResponse(CAMPAIGNS_BODY);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CabangSourceClient />);

    const pills = await screen.findByTestId("account-pills");
    expect(pills.textContent).toContain("Semua Akun (2)");
    expect(pills.textContent).toContain("DSS Motor");
    expect(pills.textContent).toContain("Pusat Grosir Mobil");

    // Default scope is the default (cached) account only — zero extra fetch on mount, same
    // "never auto-call Meta" discipline as every other `/meta-ads/*` page.
    const kpi = screen.getByTestId("cabang-source-kpi-strip");
    expect(kpi.textContent).toContain("56");
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("adAccountId=act_2")),
    ).toBe(false);

    // Explicitly selecting "Semua Akun" is a real user click — fetches the not-yet-cached
    // account and merges its ads into the KPI strip.
    await userEvent.click(screen.getByRole("button", { name: /Semua Akun/ }));
    await waitFor(() => {
      // Combined totalLead: 56 (act_1) + 10 (act_2) = 66
      expect(screen.getByTestId("cabang-source-kpi-strip").textContent).toContain("66");
    });

    await userEvent.click(screen.getByRole("button", { name: /DSS Motor/ }));
    await waitFor(() => {
      expect(screen.getByTestId("cabang-source-kpi-strip").textContent).toContain("56");
    });
  });
});
