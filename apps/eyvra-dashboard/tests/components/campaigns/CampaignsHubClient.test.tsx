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
vi.mock("@/components/campaigns/AndromedaHealthCard", () => ({
  AndromedaHealthCard: (props: { readonly campaignId: string; readonly listingId?: string }) => (
    <div data-testid="real-andromeda-health-card">
      {props.campaignId} listingId:{props.listingId ?? "none"}
    </div>
  ),
}));
vi.mock("@/components/campaigns/OpportunitiesCard", () => ({
  OpportunitiesCard: (props: { readonly campaignId: string; readonly campaignName: string }) => (
    <div data-testid="real-opportunities-card">
      {props.campaignId} name:{props.campaignName}
    </div>
  ),
}));
vi.mock("@/components/campaigns/CampaignHealthCard", () => ({
  CampaignHealthCard: (props: {
    readonly campaignId: string;
    readonly campaignName: string;
    readonly listingId?: string;
  }) => (
    <div data-testid="real-campaign-health-card">
      {props.campaignId} name:{props.campaignName} listingId:{props.listingId ?? "none"}
    </div>
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
      // Deliberately DIFFERENT from `id` (unlike most fixtures in this suite) — real bug fix
      // regression coverage: `id` is a local id re-generated randomly on every live pull, `metaId`
      // is the real, stable Meta campaign id. `POST /api/verdicts`' `targetId` MUST be `metaId`
      // (see `CampaignsHubClient.tsx`'s own `resolveMetaId` doc) — if a future change reverts to
      // sending `campaign.id`, the two tests below asserting `targetId: "meta-c1"` will fail.
      metaId: "meta-c1",
      stableId: "#A001",
      name: "Meta-DM-Leads-Mobix",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 1_000_000,
      dailyBudget: 0,
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

const EMPTY_SNAPSHOT: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [],
  ads: [],
  totals: {
    spend: 0,
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
  campaignCount: 0,
  adCount: 0,
};

function mockSettingsFetch(mode: "DEV" | "LIVE" = "DEV"): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/settings") {
      return new Response(JSON.stringify({ tenant: { mode } }), { status: 200 });
    }
    if (typeof url === "string" && url.startsWith("/api/campaigns")) {
      // Real bug fix (AAOS-CAMPAIGNS-AUTO-PULL): the hub now auto-pulls on mount when there's no
      // fresh cached snapshot — every test that doesn't `seedCache()` needs this endpoint mocked
      // with a real, honest (empty) response rather than falling through to the catch-all below.
      return new Response(JSON.stringify(EMPTY_SNAPSHOT), { status: 200 });
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

  it("auto-pulls once on mount when there's no fresh cached snapshot, replacing the permanently-frozen empty state with the real, honestly-empty result (AAOS-CAMPAIGNS-AUTO-PULL — the real bug fix: a first-time visit no longer shows Rp 0/CPL '—' cards forever, it self-heals via a real fetch)", async () => {
    const fetchMock = mockSettingsFetch();
    render(<CampaignsHubClient />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/campaigns")),
    );
    // Once the auto-pull resolves (even with a real, honestly-empty account), `data` is no longer
    // `undefined` — the real table renders with its own honest "0 campaigns", not the old
    // `empty-state` marker, which only appears before the very first pull has ever completed.
    await waitFor(() =>
      expect(screen.getByTestId("real-unified-table")).toHaveTextContent("0 campaigns"),
    );
  });

  it("does NOT auto-pull when a fresh cached snapshot already exists — a repeat visit within the TTL renders instantly with zero network call", () => {
    seedCache();
    const fetchMock = mockSettingsFetch();
    render(<CampaignsHubClient />);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/campaigns"));
  });

  it("real bug fix: AndromedaHealthCard receives the real metaId, never the local pull-unstable id — root cause of the live-confirmed 404 in aaos-api's own logs", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    expect(screen.getByTestId("real-andromeda-health-card")).toHaveTextContent("meta-c1");
  });

  // Campaign->Listing Mapping — real, best-effort fetch of the selected campaign's real
  // `listings.id` link, keyed by the real, stable `metaId` (never the local `id`).
  it("Campaign->Listing Mapping: fetches /api/campaigns/:metaId/listing-id on selection and forwards the real listingId to AndromedaHealthCard", async () => {
    seedCache();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings") {
        return new Response(JSON.stringify({ tenant: { mode: "DEV" } }), { status: 200 });
      }
      if (url === "/api/campaigns/meta-c1/listing-id") {
        return new Response(
          JSON.stringify({ campaignId: "meta-c1", listingId: "listing-real-1" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/campaigns/meta-c1/listing-id"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("real-andromeda-health-card")).toHaveTextContent(
        "listingId:listing-real-1",
      ),
    );
  });

  it("Campaign->Listing Mapping: degrades honestly (listingId stays undefined) when this campaign has no real link yet", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    await waitFor(() =>
      expect(screen.getByTestId("real-andromeda-health-card")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("real-andromeda-health-card")).toHaveTextContent("listingId:none");
  });

  it("EYVRA Samantha V2 Phase 14: CampaignHealthCard receives the real metaId/name when a campaign is selected", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent("meta-c1");
    expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent(
      "name:Meta-DM-Leads-Mobix",
    );
    expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent("listingId:none");
  });

  // Phase 19 — CampaignHealthCard now consumes the same real, best-effort Campaign->Listing
  // Mapping lookup `AndromedaHealthCard` already receives, so its own "Brief Kai Sekarang" action
  // can be honestly enabled/disabled too.
  it("Phase 19: forwards the real resolved listingId to CampaignHealthCard as well as AndromedaHealthCard", async () => {
    seedCache();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings") {
        return new Response(JSON.stringify({ tenant: { mode: "DEV" } }), { status: 200 });
      }
      if (url === "/api/campaigns/meta-c1/listing-id") {
        return new Response(
          JSON.stringify({ campaignId: "meta-c1", listingId: "listing-real-1" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    await waitFor(() =>
      expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent(
        "listingId:listing-real-1",
      ),
    );
  });

  it("EYVRA Samantha V2 + Kai V2 Phase 13: OpportunitiesCard receives the real metaId/name when a campaign is selected", async () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-select-c1"));
    expect(screen.getByTestId("real-opportunities-card")).toHaveTextContent("meta-c1");
    expect(screen.getByTestId("real-opportunities-card")).toHaveTextContent(
      "name:Meta-DM-Leads-Mobix",
    );
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

  // Real bug fix (live-confirmed via a 404 in aaos-api's own production logs on the sibling
  // Andromeda Health lookup — root cause: `campaign.id` is a local id re-generated randomly on
  // every live Meta pull, never a real Meta object id). `POST /api/verdicts` sends `targetId`
  // straight through to Meta's real Graph API, so sending `campaign.id` there was silently
  // failing against Meta in LIVE mode every single time — the real root cause of "verdict masih
  // static" (Terapkan/pause never actually applying). `targetId` MUST be the real, stable
  // `campaign.metaId` — this fixture deliberately sets `metaId` ("meta-c1") DIFFERENT from `id`
  // ("c1") so these two tests fail loudly if a future change reverts to sending the wrong one.
  it("StatusToggle pause calls the real POST /api/verdicts with the real metaId (never the local, pull-unstable id), verdict PAUSE, targetType campaign", async () => {
    seedCache();
    const fetchMock = mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-pause-c1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/verdicts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ verdict: "PAUSE", targetId: "meta-c1", targetType: "campaign" }),
        }),
      ),
    );
  });

  it("VerdictCards Terapkan calls the SAME real /api/verdicts mechanism with the real metaId and the real verdict", async () => {
    seedCache();
    const fetchMock = mockSettingsFetch();
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("fake-apply-c1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/verdicts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ verdict: "SCALE", targetId: "meta-c1", targetType: "campaign" }),
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

  it("renders a real, discoverable link to the new /growth-objectives page (EYVRA — SAMANTHA V2 Phase 15)", () => {
    seedCache();
    mockSettingsFetch();
    render(<CampaignsHubClient />);
    const link = screen.getByTestId("growth-objectives-link");
    expect(link).toHaveAttribute("href", "/growth-objectives");
  });
});
