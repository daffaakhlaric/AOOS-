import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `CampaignDetailTabs` (EYVRA Samantha V2 + Kai V2 Phase 51 — PROMPT 77/78/79/80) — proves the
 * tab bar's OWN real logic (default tab, tab switching, which real card renders in which tab,
 * props forwarded to each). Every real child card has its own independent suite
 * (`CampaignHealthCard.test.tsx`, `AutomationPanel.test.tsx`, `AndromedaHealthCard.test.tsx`,
 * `OpportunitiesCard.test.tsx`, `BudgetTracker.test.tsx`) exercising its own real behavior, so
 * those are mocked here to recognizable markers, same isolation precedent
 * `CampaignsHubClient.test.tsx` already established for its own child components.
 */
vi.mock("@/components/campaigns/CampaignHealthCard", () => ({
  CampaignHealthCard: (props: { readonly campaignId: string; readonly campaignName: string }) => (
    <div data-testid="real-campaign-health-card">
      {props.campaignId} name:{props.campaignName}
    </div>
  ),
}));
vi.mock("@/components/campaigns/AutomationPanel", () => ({
  AutomationPanel: (props: { readonly campaignId: string; readonly campaignName: string }) => (
    <div data-testid="real-automation-panel">
      {props.campaignId} name:{props.campaignName}
    </div>
  ),
}));
vi.mock("@/components/campaigns/AndromedaHealthCard", () => ({
  AndromedaHealthCard: (props: { readonly campaignId: string }) => (
    <div data-testid="real-andromeda-health-card">{props.campaignId}</div>
  ),
}));
vi.mock("@/components/campaigns/OpportunitiesCard", () => ({
  OpportunitiesCard: (props: { readonly campaignId: string }) => (
    <div data-testid="real-opportunities-card">{props.campaignId}</div>
  ),
}));
vi.mock("@/components/campaigns/BudgetTracker", () => ({
  BudgetTracker: (props: { readonly campaigns: readonly { readonly id: string }[] }) => (
    <div data-testid="real-budget-tracker">{props.campaigns.map((c) => c.id).join(",")}</div>
  ),
}));

import { CampaignDetailTabs } from "@/components/campaigns/CampaignDetailTabs";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

const CAMPAIGN: CampaignSummaryDto = {
  id: "c1",
  metaId: "meta-c1",
  stableId: "#A001",
  name: "Meta-DM-Leads-Mobix",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 1_000_000,
  dailyBudget: 0,
  adSets: [],
};

describe("CampaignDetailTabs (EYVRA Samantha V2 + Kai V2 Phase 51)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the Overview tab: CampaignHealthCard + AutomationPanel side by side, real metaId/name forwarded", () => {
    render(
      <CampaignDetailTabs campaign={CAMPAIGN} listingId={undefined} onApplyVerdict={vi.fn()} />,
    );
    expect(screen.getByTestId("campaign-detail-tab-overview")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent("meta-c1");
    expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent(
      "name:Meta-DM-Leads-Mobix",
    );
    expect(screen.getByTestId("real-automation-panel")).toHaveTextContent("meta-c1");
    expect(screen.queryByTestId("real-andromeda-health-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("real-budget-tracker")).not.toBeInTheDocument();
  });

  it("switching to Creative Health renders AndromedaHealthCard + OpportunitiesCard with the real metaId", async () => {
    render(
      <CampaignDetailTabs campaign={CAMPAIGN} listingId={undefined} onApplyVerdict={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("campaign-detail-tab-creative-health"));
    expect(screen.getByTestId("real-andromeda-health-card")).toHaveTextContent("meta-c1");
    expect(screen.getByTestId("real-opportunities-card")).toHaveTextContent("meta-c1");
    expect(screen.queryByTestId("real-campaign-health-card")).not.toBeInTheDocument();
  });

  it("switching to Anggaran renders BudgetTracker scoped to just this one campaign", async () => {
    render(
      <CampaignDetailTabs campaign={CAMPAIGN} listingId={undefined} onApplyVerdict={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("campaign-detail-tab-budget"));
    expect(screen.getByTestId("real-budget-tracker")).toHaveTextContent("c1");
  });

  it("exposes exactly 3 real tabs (Overview/Creative Health/Anggaran) — no fabricated Performance/Lead Quality/Experiments/History tab", () => {
    render(
      <CampaignDetailTabs campaign={CAMPAIGN} listingId={undefined} onApplyVerdict={vi.fn()} />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});
