import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecommendationChecklist } from "@/components/objective/RecommendationChecklist";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function baseObjective(overrides: Partial<PropertyObjectiveDto> = {}): PropertyObjectiveDto {
  return {
    id: "obj-1",
    tenantId: "tenant-1",
    period: { month: 9, year: 2026 },
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    budgetSource: "MANUAL",
    focusListings: [],
    areaPriorities: ["Bintaro"],
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    maxAutoBriefsPerDay: 5,
    autoApproveCreativeBrief: false,
    autoPublishCampaign: false,
    maxBudgetIncreasePct: 20,
    ...overrides,
  };
}

describe("RecommendationChecklist", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a real, honest empty state — never a fabricated recommendation — when no objective exists yet", () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(
      <RecommendationChecklist existingObjective={undefined} activeListingsCount={undefined} />,
    );

    expect(screen.getByTestId("recommendation-checklist-no-objective")).toHaveTextContent(
      /Belum ada data untuk direkomendasikan/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("flags business context missing and focus-listing gap for a genuinely incomplete real objective", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          id: "acc",
          name: "n",
          syncedAt: "",
          campaigns: [],
          ads: [],
          totals: {},
          campaignCount: 0,
          adCount: 0,
        }),
      ),
    ) as unknown as typeof fetch;

    const objective = baseObjective({ focusListings: [] });
    render(<RecommendationChecklist existingObjective={objective} activeListingsCount={3} />);

    expect(
      await screen.findByTestId("recommendation-business-context-missing"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("recommendation-focus-listing-empty")).toBeInTheDocument();
  });

  it("shows a real, honest all-clear state (not a fabricated one) for a fully healthy objective", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          id: "acc",
          name: "n",
          syncedAt: "",
          campaigns: [],
          ads: [],
          totals: {},
          campaignCount: 0,
          adCount: 0,
        }),
      ),
    ) as unknown as typeof fetch;

    const objective = baseObjective({
      avgDealValue: 500_000_000,
      targetCpl: 20_000,
      breakevenCpl: 30_000,
      focusListings: ["Cluster Anggrek"],
    });
    render(<RecommendationChecklist existingObjective={objective} activeListingsCount={1} />);

    expect(await screen.findByTestId("recommendation-checklist-clear")).toHaveTextContent(
      /Tidak ada isu terdeteksi/,
    );
  });
});
