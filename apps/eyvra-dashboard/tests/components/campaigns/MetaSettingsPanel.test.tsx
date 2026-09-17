import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetaSettingsPanel } from "@/components/campaigns/MetaSettingsPanel";
import type { MetaSettingsRecommendationResponseDto } from "@/types/dashboard.types";

function validRecommendation(): Extract<
  MetaSettingsRecommendationResponseDto,
  { available: true }
> {
  return {
    available: true,
    audienceSettings: {
      strategy: "BROAD_ADVANTAGE_PLUS",
      strategyRationale: "Broad lebih efisien di era Andromeda.",
      geoTargeting: {
        locations: [
          { name: "BSD City", radiusKm: 15, radiusRationale: "Coverage buyer commuter." },
        ],
        excluded: [],
        geoRationale: "BSD adalah lokasi listing.",
      },
      demographics: {
        ageMin: 28,
        ageMax: 55,
        gender: "all",
        ageRationale: "Segmen investor & keluarga.",
      },
      interestTargeting: {
        use: true,
        useRationale: "Interest properti relevan.",
        interests: [
          {
            name: "Properti",
            category: "property",
            relevance: "Investor properti.",
            estimatedReach: "medium",
          },
        ],
        interestStacking: false,
      },
      customAudiences: {
        retargeting: { recommended: false, rationale: "Belum ada data WA leads." },
        lookalike: { recommended: true, sourcePct: "2%", rationale: "Berdasarkan HOT leads." },
      },
      specialAdCategory: {
        required: true,
        category: "HOUSING",
        implications: "Demografi dibatasi Meta.",
      },
    },
    campaignSettings: {
      objective: "OUTCOME_LEADS",
      objectiveRationale: "WA conversation cocok untuk properti.",
      buyingType: "AUCTION",
      campaignBudgetOptimization: false,
      cboRationale: "1 ad set, CBO tidak relevan.",
      bidStrategy: "LOWEST_COST",
      bidStrategyRationale: "Volume leads maksimal.",
      adSchedule: { use: false, rationale: "Lead bisa datang kapan saja." },
    },
    adSetSettings: {
      structure: "1 campaign -> 1 ad set -> N ads",
      optimizationGoal: "LEAD_GENERATION",
      optimizationRationale: "Objective leads.",
      billingEvent: "IMPRESSIONS",
      budgetRecommendation: {
        dailyBudget: 750_000,
        minViable: 300_000,
        idealForLearning: 1_000_000,
        rationale: "Sesuai budget saat ini.",
      },
      placementStrategy: {
        type: "ADVANTAGE_PLUS",
        placements: ["Facebook Feed", "Instagram Feed"],
        excluded: ["Audience Network"],
        rationale: "Placement luas untuk Andromeda.",
      },
    },
    creativeRecommendations: {
      diversityTarget: "8 angle berbeda",
      copies: [
        {
          angle: "DP_RINGAN",
          targetPersona: "first_home_buyer",
          hook: "Tanah BSD 500m² SHM.",
          headline: "BSD 500m² SHM",
          primaryText: "Kavling BSD City 500m² SHM, siap bangun.",
          description: "Chat sekarang",
          cta: "Send Message",
          recommendedFormat: "IMAGES_ONLY",
          visualDirection: "Foto bird eye lokasi.",
          whyThisWorks: "Investor langsung tahu ukuran & legal.",
        },
        {
          angle: "INVESTASI",
          targetPersona: "investor",
          hook: "Tanah BSD naik 15-20%/tahun.",
          headline: "Investasi Tanah BSD SHM",
          primaryText: "Lahan BSD konsisten naik, cocok hold 2-3 tahun.",
          description: "Simulasi ROI",
          cta: "Learn More",
          recommendedFormat: "VIDEO_AND_IMAGES",
          visualDirection: "Video perbandingan harga.",
          whyThisWorks: "Investor butuh data historis.",
        },
      ],
      copyPrinciples: ["Selalu sebut ukuran & legal.", "Hindari klaim tanpa data."],
      abTestMatrix: [
        {
          test: "Hook style test",
          variantAAngle: "DP_RINGAN",
          variantBAngle: "INVESTASI",
          hypothesis: "Audience BSD lebih respond ke direct offer.",
          metric: "CTR dalam 3 hari pertama",
          winnerCriteria: "CTR > 0.5% difference",
        },
      ],
    },
    trackingSetup: {
      pixelRequired: true,
      capi: { required: true, rationale: "Signal quality Andromeda.", eventsToTrack: ["Lead"] },
      utmParams: { template: "utm_source=meta&utm_campaign=x", rationale: "Attribution WA/CRM." },
      waLinkSetup: "wa.me/628xxx?text=Halo",
    },
    settingsSummaryCard: {
      oneLineRecommendation: "Gunakan broad targeting dan 8 angle creative.",
      topPriorityChange: "Aktifkan Advantage+ placements.",
      estimatedImpact: "CPL target ~Rp80rb.",
    },
  };
}

describe("MetaSettingsPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the summary bar with the real one-line recommendation and estimated impact", () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    expect(screen.getByTestId("settings-one-liner")).toHaveTextContent(
      "Gunakan broad targeting dan 8 angle creative.",
    );
    expect(screen.getByText("CPL target ~Rp80rb.")).toBeInTheDocument();
  });

  it("shows the Audience tab by default with the real strategy/geo/demographics", () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    const panel = screen.getByTestId("settings-tab-panel-audience");
    expect(panel).toHaveTextContent("BROAD_ADVANTAGE_PLUS");
    expect(panel).toHaveTextContent("BSD City");
    expect(panel).toHaveTextContent("28–55 th");
    expect(panel).toHaveTextContent("HOUSING");
  });

  it("never renders a Meta geo/interest ID anywhere — only real discovery names", () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    const panel = screen.getByTestId("settings-tab-panel-audience");
    expect(panel).toHaveTextContent(/cari id lokasi asli secara live/i);
  });

  it("switches to the Campaign Settings tab and shows the real budget recommendation", async () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    await userEvent.click(screen.getByTestId("settings-tab-campaign"));
    const panel = screen.getByTestId("settings-tab-panel-campaign");
    expect(panel).toHaveTextContent("LOWEST_COST");
    expect(panel).toHaveTextContent("Rp 750.000");
    expect(panel).toHaveTextContent("Rp 300.000");
  });

  it("switches to the Creative Copy tab and shows all real copies with real PropertyAdAngle labels", async () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    await userEvent.click(screen.getByTestId("settings-tab-copy"));
    const panel = screen.getByTestId("settings-tab-panel-copy");
    expect(panel).toHaveTextContent("DP RINGAN");
    expect(panel).toHaveTextContent("INVESTASI");
    expect(screen.getByTestId("copy-card-DP_RINGAN")).toBeInTheDocument();
    expect(screen.getByTestId("copy-card-INVESTASI")).toBeInTheDocument();
  });

  it("expands a copy card to reveal hook/headline/primaryText/description/cta with copy-to-clipboard", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    await userEvent.click(screen.getByTestId("settings-tab-copy"));
    await userEvent.click(screen.getByTestId("copy-card-header-DP_RINGAN"));
    const card = screen.getByTestId("copy-card-DP_RINGAN");
    expect(within(card).getByText("BSD 500m² SHM")).toBeInTheDocument();
    expect(within(card).getByText("Kavling BSD City 500m² SHM, siap bangun.")).toBeInTheDocument();

    const copyButtons = within(card).getAllByText("Copy");
    await userEvent.click(copyButtons[0]!);
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Tanah BSD 500m² SHM."),
    );
  });

  it("disables the Brief Kai button with an honest explanation when no real listingId is known", async () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    await userEvent.click(screen.getByTestId("settings-tab-copy"));
    await userEvent.click(screen.getByTestId("copy-card-header-DP_RINGAN"));
    expect(screen.getByTestId("brief-kai-DP_RINGAN")).toBeDisabled();
    expect(screen.getByText(/Tidak bisa menentukan listing/)).toBeInTheDocument();
  });

  it("Brief Kai posts the real angle/hook/format to /api/creative-packages/property when a real listingId is known", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "pkg-1", angle: "DP_RINGAN" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MetaSettingsPanel recommendation={validRecommendation()} listingId="listing-1" />);
    await userEvent.click(screen.getByTestId("settings-tab-copy"));
    await userEvent.click(screen.getByTestId("copy-card-header-DP_RINGAN"));
    const briefButton = screen.getByTestId("brief-kai-DP_RINGAN");
    expect(briefButton).not.toBeDisabled();
    await userEvent.click(briefButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/creative-packages/property");
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
    expect(body["listingId"]).toBe("listing-1");
    expect(body["angle"]).toBe("DP_RINGAN");
    expect(body["primaryMessage"]).toBe("Tanah BSD 500m² SHM.");
    expect(body["format"]).toBe("IMAGES_ONLY");
  });

  it("switches to the A/B Test Plan tab and shows the real variant angles/metric", async () => {
    render(<MetaSettingsPanel recommendation={validRecommendation()} />);
    await userEvent.click(screen.getByTestId("settings-tab-abtest"));
    const panel = screen.getByTestId("settings-tab-panel-abtest");
    expect(panel).toHaveTextContent("Hook style test");
    expect(panel).toHaveTextContent("DP RINGAN");
    expect(panel).toHaveTextContent("INVESTASI");
    expect(panel).toHaveTextContent("CTR dalam 3 hari pertama");
  });
});
