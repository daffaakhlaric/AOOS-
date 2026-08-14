import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { SimulasiClient } from "@/components/meta-ads/SimulasiClient";
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
    ...overrides,
  };
}

const DATA: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [],
  ads: [
    {
      id: "ad-refresh",
      stableId: "#C001",
      name: "Xpander Cross 2019",
      campaignName: "Campaign A",
      status: "ACTIVE",
      funnel: "DM",
      branch: "CINERE",
      verdict: "REFRESH",
      metrics: metrics({ frequency: 4.1 }),
    },
    {
      id: "ad-fine",
      stableId: "#C002",
      name: "Ad Fine",
      campaignName: "Campaign B",
      status: "ACTIVE",
      funnel: "DM",
      branch: "UMUM",
      verdict: "KEEP",
      metrics: metrics({ frequency: 1.2 }),
    },
  ],
  totals: metrics({}),
  campaignCount: 2,
  adCount: 2,
};

describe("SimulasiClient", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when there is no cache", async () => {
    render(<SimulasiClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("Step 1 lists only ads needing refresh (verdict=REFRESH or frequency >= 3.5)", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    render(<SimulasiClient />);

    const step1 = await screen.findByTestId("simulasi-step-1");
    expect(step1.textContent).toContain("Xpander Cross 2019");
    expect(step1.textContent).not.toContain("Ad Fine");
  });

  it("selecting an ad in Step 1 reveals Step 2, and Generate Brief calls /api/llm/creative-brief", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    const aiBrief = {
      unit: "Xpander Cross 2019",
      angle: "DP_RINGAN",
      branch: "CINERE",
      primaryMessage: "DP mulai 29 juta",
      tone: "casual, relatable",
      formats: ["VIDEO_15S", "IMAGE_SQUARE"],
      avoid: ["klaim berlebihan"],
      urgency: "HIGH",
      reason: "frequency tinggi",
    };
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/creative-brief")) return jsonResponse(aiBrief);
      return jsonResponse(DATA);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SimulasiClient />);
    await userEvent.click(await screen.findByRole("button", { name: /Pilih iklan ini/ }));
    expect(await screen.findByTestId("simulasi-step-2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Generate Brief/ }));
    await waitFor(() => expect(screen.getByTestId("creative-brief-preview")).toBeInTheDocument());
    expect(screen.getByTestId("creative-brief-preview").textContent).toContain("DP mulai 29 juta");
  });

  it("falls back to a real-ad-derived brief (not the AI one) when /api/llm/creative-brief fails", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/creative-brief")) return jsonResponse({}, 503);
      return jsonResponse(DATA);
    }) as unknown as typeof fetch;

    render(<SimulasiClient />);
    await userEvent.click(await screen.findByRole("button", { name: /Pilih iklan ini/ }));
    await userEvent.click(screen.getByRole("button", { name: /Generate Brief/ }));

    const preview = await screen.findByTestId("creative-brief-preview");
    expect(preview.textContent).toContain("AI tidak tersedia");
    expect(preview.textContent).toContain("Xpander Cross 2019");
  });

  it("walks through Step 3 (client-side simulation, no backend call) and Step 4, and Approve & Launch navigates to /creative", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/creative-brief")) return jsonResponse({}, 503);
      return jsonResponse(DATA);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SimulasiClient />);
    await userEvent.click(await screen.findByRole("button", { name: /Pilih iklan ini/ }));
    await userEvent.click(screen.getByRole("button", { name: /Generate Brief/ }));
    await screen.findByTestId("creative-brief-preview");

    const callsBeforeStep3 = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: /Lanjut ke Step 3/ }));
    expect(await screen.findByTestId("simulasi-step-3")).toBeInTheDocument();
    expect(screen.getByText(/Kai menerima brief dari Tamara/)).toBeInTheDocument();
    // Step 3 is a pure client-side simulation — no new network call.
    expect(fetchMock.mock.calls.length).toBe(callsBeforeStep3);

    await userEvent.click(screen.getByRole("button", { name: /Simulasi Generate/ }));
    expect(await screen.findByTestId("simulasi-step-4")).toBeInTheDocument();
    expect(screen.getByText("🎬 Video")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Approve & Launch/ }));
    expect(pushMock).toHaveBeenCalledWith("/creative");
  });

  it("Tamara chat widget sends a message and shows the reply", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/chat")) {
        return jsonResponse({ reply: "Bandung mahal karena CPM tinggi." });
      }
      return jsonResponse(DATA);
    }) as unknown as typeof fetch;

    render(<SimulasiClient />);
    const chatInput = await screen.findByLabelText("Tanya Tamara");
    await userEvent.type(chatInput, "Kenapa Bandung mahal?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText("Bandung mahal karena CPM tinggi.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Kenapa Bandung mahal?")).toBeInTheDocument();
  });

  it("chat widget shows a fallback message when /api/llm/chat fails", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/llm/chat")) return jsonResponse({}, 500);
      return jsonResponse(DATA);
    }) as unknown as typeof fetch;

    render(<SimulasiClient />);
    const chatInput = await screen.findByLabelText("Tanya Tamara");
    await userEvent.type(chatInput, "Halo Tamara");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText("Tamara tidak bisa menjawab saat ini.")).toBeInTheDocument(),
    );
  });
});
