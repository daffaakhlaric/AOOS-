import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntelligenceSignalsCard } from "@/components/meta-ads/IntelligenceSignalsCard";
import type { IntelligenceSignalsDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function buildSignals(overrides: Partial<IntelligenceSignalsDto> = {}): IntelligenceSignalsDto {
  return {
    id: "sig-1",
    branchId: null,
    seasonal: { isSpecialPeriod: true, eventName: "Gajian", reasoning: "Gajian dalam 8 hari" },
    trends: {
      available: true,
      suggestedAngle: "TUKAR_TAMBAH",
      reasoning: '"kredit mobil" naik 35% di area Cinere',
    },
    competitor: {
      available: true,
      unusedAngles: ["TUKAR_TAMBAH"],
      reasoning: "TUKAR_TAMBAH belum dipakai kompetitor",
    },
    inventory: { available: true, hasNewArrivals: false, reasoning: "Total listing aktif: 12." },
    leadProfile: {
      totalLeads: 42,
      avgScore: 78.4,
      topBranches: [{ branchId: "DEPOK", count: 20 }],
    },
    closing: {
      totalEvents: 15,
      topUnitModels: [{ unitModel: "Avanza", spkCount: 10, closingRate: 0.72 }],
      slowUnitModels: [],
    },
    capiHealth: {
      available: true,
      pixelId: "pixel-1",
      score: 7.2,
      eventsReceived: 12,
      capturedAt: "2026-08-24T05:00:00.000Z",
      reasoning: "CAPI Event Match Quality score 7.2/10, 12 event diterima.",
    },
    anomalies: {
      available: true,
      anomalies: [],
      reasoning: "Tidak ada anomali frequency terdeteksi.",
    },
    campaignStrategy: {
      available: true,
      campaignMode: "BOTH",
      reasoning: "Kombinasi brand + product karena stok terbatas.",
      brandCampaign: {
        angle: "TUKAR_TAMBAH",
        copy: "Tukar tambah mudah!",
        objective: "OUTCOME_AWARENESS",
        budgetPct: 30,
        reasoning: "Kompetitor belum pakai angle ini.",
      },
      productCampaign: {
        angle: "STOK_TERBATAS",
        targetUnit: "Xpander",
        copy: "Stok terbatas, buruan!",
        objective: "OUTCOME_LEADS",
        budgetPct: 70,
        reasoning: "Xpander stok menipis.",
      },
      budgetRecommendation: { action: "SCALE", multiplier: 1.2, reasoning: "Performa bagus." },
      summary: "Fokus TUKAR_TAMBAH + STOK_TERBATAS Xpander.",
      urgency: "HIGH",
    },
    digestText: "🧠 Samantha Intelligence — Mobix",
    generatedAt: "2026-08-24T06:00:00.000Z",
    ...overrides,
  };
}

describe("IntelligenceSignalsCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state (404) with a prompt to run the first refresh", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 404)) as unknown as typeof fetch;
    render(<IntelligenceSignalsCard />);
    expect(await screen.findByText(/Belum ada Samantha Intelligence run/)).toBeInTheDocument();
  });

  it("renders one real line per signal source + the real Samantha strategy recommendation", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ signals: buildSignals() }),
    ) as unknown as typeof fetch;
    render(<IntelligenceSignalsCard />);

    const result = await screen.findByTestId("intelligence-signals-result");
    expect(result.textContent).toContain('"kredit mobil" naik 35% di area Cinere');
    expect(result.textContent).toContain("Gajian dalam 8 hari");
    expect(result.textContent).toContain("TUKAR_TAMBAH belum dipakai kompetitor");
    expect(result.textContent).toContain("Total listing aktif: 12.");
    expect(result.textContent).toContain("42 hot lead");
    expect(result.textContent).toContain("Avanza");
    expect(result.textContent).toContain("BRAND 30% TUKAR_TAMBAH");
    expect(result.textContent).toContain("PRODUCT 70% STOK_TERBATAS");
  });

  it("renders the honest AUTOMOTIVE inventory-unavailable state, never a fabricated stock number", async () => {
    const signals = buildSignals({
      inventory: {
        available: false,
        reasoning:
          "Belum ada IInventoryQueryService real yang dikomposisi di aaos-api untuk AUTOMOTIVE — lihat IntelligenceService docstring.",
      },
    });
    global.fetch = vi.fn(async () => jsonResponse({ signals })) as unknown as typeof fetch;
    render(<IntelligenceSignalsCard />);

    const result = await screen.findByTestId("intelligence-signals-result");
    expect(result.textContent).toContain("Data stok otomotif belum tersedia");
    expect(result.textContent).not.toMatch(/tinggal \d+ unit/);
  });

  it("shows an honest 'AI tidak tersedia' state when campaignStrategy degraded, never a fabricated recommendation", async () => {
    const signals = buildSignals({
      campaignStrategy: {
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      },
    });
    global.fetch = vi.fn(async () => jsonResponse({ signals })) as unknown as typeof fetch;
    render(<IntelligenceSignalsCard />);

    const result = await screen.findByTestId("intelligence-signals-result");
    expect(result.textContent).toContain("AI tidak tersedia");
    expect(result.textContent).toContain("NO_API_KEY");
  });

  it("Refresh calls the real POST /api/intelligence/refresh and re-renders with the fresh result", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("/api/intelligence/refresh")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({ signals: buildSignals({ id: "sig-2" }) });
      }
      return jsonResponse({}, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<IntelligenceSignalsCard />);
    await screen.findByText(/Belum ada Samantha Intelligence run/);

    await userEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() =>
      expect(screen.getByTestId("intelligence-signals-result")).toBeInTheDocument(),
    );
    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/intelligence/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("shows an error state when the load fails with a non-404 status", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "aaos-api tidak terjangkau" } }, 500),
    ) as unknown as typeof fetch;
    render(<IntelligenceSignalsCard />);
    expect(await screen.findByText("aaos-api tidak terjangkau")).toBeInTheDocument();
  });
});
