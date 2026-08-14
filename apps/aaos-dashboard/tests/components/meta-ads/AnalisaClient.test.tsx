import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalisaClient } from "@/components/meta-ads/AnalisaClient";
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
    totalLead: 20,
    rphD3: null,
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
      stableId: "#A001",
      name: "Meta-DM-Leads-Cinere",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 500_000,
      adSets: [
        {
          id: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 500_000,
          ads: [
            {
              id: "ad-1",
              stableId: "#C001",
              name: "Ad Cinere Cheap",
              status: "ACTIVE",
              funnel: "DM",
              branch: "CINERE",
              verdict: "SCALE",
              metrics: metrics({ spend: 500_000, conversations: 50, totalLead: 100 }),
            },
          ],
        },
      ],
    },
    {
      id: "c2",
      stableId: "#A002",
      name: "Meta-DM-Leads-Bandung",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 2_000_000,
      adSets: [
        {
          id: "as2",
          stableId: "#B002",
          name: "AdSet 2",
          status: "ACTIVE",
          spend: 2_000_000,
          ads: [
            {
              id: "ad-2",
              stableId: "#C002",
              name: "Ad Bandung Expensive",
              status: "ACTIVE",
              funnel: "DM",
              branch: "BANDUNG",
              verdict: "PAUSE",
              metrics: metrics({ spend: 2_000_000, conversations: 10, totalLead: 5 }),
            },
          ],
        },
      ],
    },
  ],
  ads: [
    {
      id: "ad-1",
      stableId: "#C001",
      name: "Ad Cinere Cheap",
      campaignName: "Meta-DM-Leads-Cinere",
      status: "ACTIVE",
      funnel: "DM",
      branch: "CINERE",
      verdict: "SCALE",
      metrics: metrics({ spend: 500_000, conversations: 50, totalLead: 100 }),
    },
    {
      id: "ad-2",
      stableId: "#C002",
      name: "Ad Bandung Expensive",
      campaignName: "Meta-DM-Leads-Bandung",
      status: "ACTIVE",
      funnel: "DM",
      branch: "BANDUNG",
      verdict: "PAUSE",
      metrics: metrics({ spend: 2_000_000, conversations: 10, totalLead: 5 }),
    },
  ],
  totals: metrics({ spend: 2_500_000, conversations: 60, totalLead: 105 }),
  campaignCount: 2,
  adCount: 2,
};

describe("AnalisaClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when there is no cache", async () => {
    render(<AnalisaClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("shows Cinere (cheap) as SCALE and Bandung (expensive) as CUT in the per-cabang verdict table", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AnalisaClient />);

    const table = await screen.findByTestId("analisa-branch-verdict");
    // Cinere: 500_000 / 100 leads = Rp 5.000/lead → SCALE.
    // Bandung: 2_000_000 / 5 leads = Rp 400.000/lead → CUT.
    expect(table.textContent).toContain("CINERE");
    expect(table.textContent).toContain("SCALE");
    expect(table.textContent).toContain("BANDUNG");
    expect(table.textContent).toContain("CUT");
  });

  it("renders per-ad verdicts using the real ad.verdict field (not recomputed)", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AnalisaClient />);

    const table = await screen.findByTestId("analisa-ad-verdict");
    expect(table.textContent).toContain("Ad Cinere Cheap");
    expect(table.textContent).toContain("Ad Bandung Expensive");
  });

  it("shows Temuan Utama with cheapest/priciest branch and waste detected", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    render(<AnalisaClient />);

    const temuan = await screen.findByTestId("analisa-temuan");
    expect(temuan.textContent).toContain("Cabang termurah: CINERE");
    expect(temuan.textContent).toContain("termahal");
  });

  it("calls /api/llm/analyze and renders the AI result on success", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    const aiResult = {
      temuan: [{ icon: "🔴", judul: "Bandung mahal", detail: "Rp/lead tinggi" }],
      rekomendasi: [
        {
          aksi: "PAUSE",
          target: "#C002 Ad Bandung Expensive",
          alasan: "boros",
          estimasi: "hemat Rp 1jt",
        },
      ],
      ringkasan: "Kondisi iklan cukup baik secara umum.",
    };
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/analyze")) return jsonResponse(aiResult);
      return jsonResponse(CAMPAIGNS_BODY);
    }) as unknown as typeof fetch;

    render(<AnalisaClient />);
    await screen.findByTestId("analisa-temuan");
    await userEvent.click(screen.getByRole("button", { name: /Analisa dengan AI/ }));

    await waitFor(() => expect(screen.getByTestId("ai-result")).toBeInTheDocument());
    expect(screen.getByTestId("ai-result").textContent).toContain("Bandung mahal");
    expect(screen.getByTestId("ai-result").textContent).toContain(
      "Kondisi iklan cukup baik secara umum.",
    );
  });

  it("shows the 'enable OPENAI_API_KEY' fallback message on a 503 from /api/llm/analyze, while still showing rule-based analysis", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/analyze")) return jsonResponse({}, 503);
      return jsonResponse(CAMPAIGNS_BODY);
    }) as unknown as typeof fetch;

    render(<AnalisaClient />);
    await screen.findByTestId("analisa-temuan");
    await userEvent.click(screen.getByRole("button", { name: /Analisa dengan AI/ }));

    await waitFor(() => expect(screen.getByText(/Aktifkan AI Analysis/)).toBeInTheDocument());
    // Rule-based analysis is still visible.
    expect(screen.getByTestId("analisa-branch-verdict")).toBeInTheDocument();
  });

  it("shows the generic AI-unavailable fallback message on any other failure (e.g. endpoint not deployed yet)", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/analyze")) return jsonResponse({}, 404);
      return jsonResponse(CAMPAIGNS_BODY);
    }) as unknown as typeof fetch;

    render(<AnalisaClient />);
    await screen.findByTestId("analisa-temuan");
    await userEvent.click(screen.getByRole("button", { name: /Analisa dengan AI/ }));

    await waitFor(() =>
      expect(screen.getByText(/AI Analysis tidak tersedia saat ini/)).toBeInTheDocument(),
    );
    expect(screen.getByTestId("analisa-branch-verdict")).toBeInTheDocument();
  });

  it("shows the generic fallback message when the fetch itself throws", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/analyze")) throw new Error("network down");
      return jsonResponse(CAMPAIGNS_BODY);
    }) as unknown as typeof fetch;

    render(<AnalisaClient />);
    await screen.findByTestId("analisa-temuan");
    await userEvent.click(screen.getByRole("button", { name: /Analisa dengan AI/ }));

    await waitFor(() =>
      expect(screen.getByText(/AI Analysis tidak tersedia saat ini/)).toBeInTheDocument(),
    );
  });
});
