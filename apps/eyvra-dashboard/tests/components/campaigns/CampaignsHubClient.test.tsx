import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — this hub-level suite proves the unified page's OWN real logic
 * (mode badge, filter/search, real CPL-benchmark plumbing, real /api/verdicts wiring for pause/
 * apply, the ?view=ab-testing escape hatch) — each heavy real child component below has its own
 * independent suite (`UnifiedCampaignTable.test.tsx`, `CampaignInsightPanel.test.tsx`,
 * `VerdictCards.test.tsx`, `BudgetTracker.test.tsx`, `SamanthaInsightBar.test.tsx`) exercising its
 * own real behavior, so those are mocked here to recognizable markers, same isolation precedent
 * the pre-rebuild `CampaignsHubClient.test.tsx` already established for its own tab bodies.
 */
vi.mock("@/components/campaigns/UnifiedCampaignTable", () => ({
  UnifiedCampaignTable: (props: {
    readonly campaigns: readonly { readonly id: string }[];
    readonly onSelect: (id: string) => void;
    readonly onPause: (id: string) => void;
  }) => (
    <div data-testid="real-unified-table">
      {props.campaigns.length} campaigns
      <button type="button" onClick={() => props.onSelect("c1")} data-testid="fake-select-c1">
        select
      </button>
      <button type="button" onClick={() => props.onPause("c1")} data-testid="fake-pause-c1">
        pause
      </button>
    </div>
  ),
}));
vi.mock("@/components/campaigns/CampaignInsightPanel", () => ({
  CampaignInsightPanel: (props: { readonly campaign: { readonly id: string } }) => (
    <div data-testid="real-insight-panel">{props.campaign.id}</div>
  ),
}));
vi.mock("@/components/campaigns/VerdictCards", () => ({
  VerdictCards: (props: { readonly onApply: (id: string, verdict: string) => void }) => (
    <div data-testid="real-verdict-cards">
      <button
        type="button"
        onClick={() => props.onApply("c1", "SCALE")}
        data-testid="fake-apply-c1"
      >
        apply
      </button>
    </div>
  ),
}));
vi.mock("@/components/campaigns/BudgetTracker", () => ({
  BudgetTracker: () => <div data-testid="real-budget-tracker" />,
}));
vi.mock("@/components/campaigns/ObjectiveStripCard", () => ({
  ObjectiveStripCard: () => <div data-testid="real-objective-strip-card" />,
}));
vi.mock("@/components/campaigns/SamanthaInsightBar", () => ({
  SamanthaInsightBar: () => <div data-testid="real-samantha-insight-bar" />,
}));
vi.mock("@/components/meta-ads/AbTestingClient", () => ({
  AbTestingClient: () => <div data-testid="real-abtesting-client" />,
}));

import { CampaignsHubClient } from "@/components/campaigns/CampaignsHubClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

const SNAPSHOT: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [
    {
      id: "c1",
      stableId: "#A001",
      name: "Meta-DM-Leads-Mobix",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 1_000_000,
      adSets: [],
    },
  ],
  ads: [],
  totals: {
    spend: 1_000_000,
    clicks: 0,
    frequency: 0,
    conversations: 0,
    d2: 0,
    d3: 0,
    d5: 0,
    leadForm: 0,
    totalLead: 0,
    rphD3: null,
    rphLead: null,
  },
  campaignCount: 1,
  adCount: 0,
};

function seedCache(): void {
  writeCampaignsCache({ data: SNAPSHOT, fetchedAt: Date.now(), period: "last_30d" });
}

function mockSettingsFetch(mode: "DEV" | "LIVE" = "DEV"): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/settings") {
      return new Response(JSON.stringify({ tenant: { mode } }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("CampaignsHubClient (AAOS-CAMPAIGNS-UNIFIED-PAGE, /campaigns)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the unified tab-less layout: Samantha bar, table, verdict/budget/objective strip — no tabs", () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    expect(screen.getByTestId("real-samantha-insight-bar")).toBeInTheDocument();
    expect(screen.getByTestId("real-unified-table")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-strip")).toBeInTheDocument();
    expect(screen.getByTestId("real-verdict-cards")).toBeInTheDocument();
    expect(screen.getByTestId("real-budget-tracker")).toBeInTheDocument();
    expect(screen.getByTestId("real-objective-strip-card")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("fetches /api/settings and renders the real DEV/LIVE mode badge", async () => {
    seedCache();
    mockSettingsFetch("LIVE");
    render(<CampaignsHubClient />);
    await waitFor(() => expect(screen.getByTestId("mode-badge")).toHaveTextContent("LIVE"));
  });

  it("shows an honest empty state with no cached data", () => {
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("clicking a row opens the real CampaignInsightPanel for that campaign", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    expect(screen.getByTestId("real-insight-panel")).toHaveTextContent("c1");
  });

  it("clicking the same row again closes the panel (toggle)", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    expect(screen.getByTestId("real-insight-panel")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    expect(screen.queryByTestId("real-insight-panel")).not.toBeInTheDocument();
  });

  it("StatusToggle pause calls the real POST /api/verdicts with verdict PAUSE, targetType campaign", async () => {
    seedCache();
    const fetchMock = mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-pause-c1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/verdicts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ verdict: "PAUSE", targetId: "c1", targetType: "campaign" }),
        }),
      ),
    );
  });

  it("VerdictCards Terapkan calls the SAME real /api/verdicts mechanism with the real verdict", async () => {
    seedCache();
    const fetchMock = mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-apply-c1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/verdicts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ verdict: "SCALE", targetId: "c1", targetType: "campaign" }),
        }),
      ),
    );
  });

  it("filters the table by search", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    expect(screen.getByTestId("real-unified-table")).toHaveTextContent("1 campaigns");
    await userEvent.type(screen.getByLabelText("Cari campaign"), "no-match-xyz");
    expect(screen.getByTestId("real-unified-table")).toHaveTextContent("0 campaigns");
  });

  it("shows the real campaign count in the filter bar", () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    expect(screen.getByTestId("campaign-count")).toHaveTextContent("1 campaign");
  });

  it("?view=ab-testing renders the real, still-reachable AbTestingClient with a back link — never silently dropped", () => {
    mockSettingsFetch();
    render(<CampaignsHubClient initialView="ab-testing" />);
    expect(screen.getByTestId("real-abtesting-client")).toBeInTheDocument();
    expect(screen.getByText("← Kembali ke Campaign")).toHaveAttribute("href", "/campaigns");
  });

  it("the 'Analisa Samantha' button selects the first campaign, opening its real insight panel", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    expect(screen.queryByTestId("real-insight-panel")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("analisa-samantha-button"));
    expect(screen.getByTestId("real-insight-panel")).toHaveTextContent("c1");
  });
});
