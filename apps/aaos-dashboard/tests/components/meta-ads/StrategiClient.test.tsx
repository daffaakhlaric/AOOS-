import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StrategiClient } from "@/components/meta-ads/StrategiClient";
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
    totalLead: 10,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

function buildData(fetchedAt: number): AdAccountSummaryDto {
  return {
    id: "act_1",
    name: "Mobix Main",
    syncedAt: new Date(fetchedAt).toISOString(),
    campaigns: [],
    ads: [
      {
        id: "ad-pause",
        stableId: "#C001",
        name: "Ad To Pause",
        campaignName: "Campaign A",
        status: "ACTIVE",
        funnel: "DM",
        branch: "BINTARO",
        verdict: "PAUSE",
        metrics: metrics({ spend: 800_000, conversations: 5 }),
      },
      {
        id: "ad-scale",
        stableId: "#C002",
        name: "Ad To Scale",
        campaignName: "Campaign B",
        status: "ACTIVE",
        funnel: "DM",
        branch: "CINERE",
        verdict: "SCALE",
        metrics: metrics({ spend: 300_000, conversations: 30, totalLead: 40 }),
      },
      {
        id: "ad-keep",
        stableId: "#C003",
        name: "Ad Keep",
        campaignName: "Campaign C",
        status: "ACTIVE",
        funnel: "DM",
        branch: "UMUM",
        verdict: "KEEP",
        metrics: metrics({}),
      },
    ],
    totals: metrics({ spend: 1_100_000, conversations: 35, totalLead: 50 }),
    campaignCount: 3,
    adCount: 3,
  };
}

describe("StrategiClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when there is no cache", async () => {
    render(<StrategiClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("lists only ads whose verdict is not KEEP, with the right proposed action", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);

    const list = await screen.findByTestId("strategi-list");
    expect(list.textContent).toContain("Ad To Pause");
    expect(list.textContent).toContain("● Matikan");
    expect(list.textContent).toContain("Ad To Scale");
    expect(list.textContent).toContain("● Naikkan budget");
    expect(list.textContent).not.toContain("Ad Keep");
  });

  it("marks an item 'Disetujui ✅' after clicking Setujui, and persists the decision across remounts of the same snapshot", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    const { unmount } = render(<StrategiClient />);
    await screen.findByTestId("strategi-list");

    const approveButtons = screen.getAllByRole("button", { name: /Setujui/ });
    await userEvent.click(approveButtons[0]!);
    expect(await screen.findByTestId("approved-badge-ad-pause")).toBeInTheDocument();

    unmount();
    render(<StrategiClient />);
    expect(await screen.findByTestId("approved-badge-ad-pause")).toBeInTheDocument();
  });

  it("Tolak does not mark an item approved", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");

    const rejectButtons = screen.getAllByRole("button", { name: /^Tolak$/ });
    await userEvent.click(rejectButtons[0]!);
    expect(screen.queryByTestId("approved-badge-ad-pause")).not.toBeInTheDocument();
  });

  it("Execute Semua yang Disetujui calls POST /api/verdicts once per approved ad (never a bulk array)", async () => {
    const fetchedAt = Date.now();
    const data = buildData(fetchedAt);
    writeCampaignsCache({ data, fetchedAt, period: "last_30d" });
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/verdicts")) return jsonResponse({ action: "PAUSED" });
      return jsonResponse(data);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");
    const approveButtons = screen.getAllByRole("button", { name: /Setujui/ });
    await userEvent.click(approveButtons[0]!);
    await userEvent.click(approveButtons[1]!);

    await userEvent.click(screen.getByRole("button", { name: /Execute Semua/ }));

    await waitFor(() => {
      const verdictCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/verdicts"),
      );
      expect(verdictCalls).toHaveLength(2);
    });
    for (const [, init] of fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/verdicts"),
    )) {
      const parsed: unknown = JSON.parse(String(init?.body));
      expect(Array.isArray(parsed)).toBe(false);
    }
  });

  it("handles partial failure: one item fails, one succeeds, and both are reported", async () => {
    const fetchedAt = Date.now();
    const data = buildData(fetchedAt);
    writeCampaignsCache({ data, fetchedAt, period: "last_30d" });
    let callCount = 0;
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/verdicts")) {
        callCount += 1;
        return callCount === 1 ? jsonResponse({ action: "PAUSED" }) : jsonResponse({}, 500);
      }
      return jsonResponse(data);
    }) as unknown as typeof fetch;

    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");
    const approveButtons = screen.getAllByRole("button", { name: /Setujui/ });
    await userEvent.click(approveButtons[0]!);
    await userEvent.click(approveButtons[1]!);

    await userEvent.click(screen.getByRole("button", { name: /Execute Semua/ }));

    await waitFor(() => expect(screen.getByTestId("execute-summary")).toBeInTheDocument());
    expect(screen.getByTestId("execute-summary").textContent).toContain("1/2 berhasil");
    expect(screen.getByTestId("execute-summary").textContent).toContain("1 gagal");
  });

  it("shows a KEEP-only empty state when no ad needs action", async () => {
    const fetchedAt = Date.now();
    const data = { ...buildData(fetchedAt), ads: [buildData(fetchedAt).ads[2]!] };
    writeCampaignsCache({ data, fetchedAt, period: "last_30d" });
    render(<StrategiClient />);

    expect(await screen.findByText(/Semua iklan sudah KEEP/)).toBeInTheDocument();
  });

  it("shows the real KPI strip counts (Total Usulan/Matikan/Scale) from real ad.verdict, never a recomputed threshold", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);

    const kpi = await screen.findByTestId("strategi-kpi-strip");
    expect(kpi.textContent).toContain("Total Usulan");
    expect(kpi.textContent).toContain("2"); // PAUSE + SCALE, KEEP excluded
    expect(kpi.textContent).toContain("Potensi Hemat");
    expect(kpi.textContent).toContain("Rp 800"); // the one PAUSE ad's real spend
  });

  it("requests Arahan Tamara via the real /api/llm/analyze shape ({temuan, rekomendasi, ringkasan}), not the spec's fictional {arahan, temuan:{summary,findings}}", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/analyze")) {
        return jsonResponse({
          temuan: [{ icon: "🎯", judul: "Cabang termahal", detail: "Bandung Rp30rb/lead" }],
          rekomendasi: [],
          ringkasan: "Fokuskan budget ke Bintaro bulan ini.",
        });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<StrategiClient />);
    await screen.findByTestId("strategi-arahan-card");
    await userEvent.click(screen.getByRole("button", { name: /Minta Arahan Tamara/ }));

    const result = await screen.findByTestId("strategi-arahan-result");
    expect(result.textContent).toContain("Fokuskan budget ke Bintaro bulan ini.");
    expect(result.textContent).toContain("Cabang termahal");
  });

  it("sends a chat message via /api/llm/chat and renders Tamara's reply", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/chat")) {
        return jsonResponse({ reply: "Fokuskan ke Bintaro dulu." });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<StrategiClient />);
    const chatWidget = await screen.findByTestId("tamara-chat-widget");
    await userEvent.type(
      screen.getByLabelText("Tanya Tamara"),
      "Apa 3 langkah paling mendesak minggu ini?",
    );
    await userEvent.click(within(chatWidget).getByRole("button", { name: "Kirim" }));

    await waitFor(() => expect(chatWidget.textContent).toContain("Fokuskan ke Bintaro dulu."));
  });

  it("filters the list by verdict via the filter tabs", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");

    await userEvent.click(screen.getByRole("button", { name: "Scale" }));
    const list = screen.getByTestId("strategi-list");
    expect(list.textContent).toContain("Ad To Scale");
    expect(list.textContent).not.toContain("Ad To Pause");
  });

  it("does not offer a 'Geser' filter tab or verdict — not a real Verdict enum member", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);

    const tabs = await screen.findByTestId("strategi-filter-tabs");
    expect(tabs.textContent).not.toContain("Geser");
  });
});
