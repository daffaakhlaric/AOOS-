import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CampaignDetailDrawer } from "@/components/campaigns/CampaignDetailDrawer";
import type { AdSetSummaryDto } from "@/types/dashboard.types";

function metrics(overrides: Partial<AdSetSummaryDto["ads"][number]["metrics"]> = {}) {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.5,
    conversations: 50,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 12,
    rphD3: 100_000,
    rphLead: 83_333,
    ...overrides,
  };
}

const AD_SET: AdSetSummaryDto = {
  id: "as1",
  stableId: "#B001",
  name: "AdSet Bintaro",
  status: "ACTIVE",
  spend: 2_000_000,
  ads: [
    {
      id: "ad1",
      stableId: "#C001",
      name: "Xpander Creative 1",
      status: "ACTIVE",
      funnel: "DM",
      branch: "BINTARO",
      verdict: "SCALE",
      metrics: metrics({ rphLead: 40_000 }),
    },
    {
      id: "ad2",
      stableId: "#C002",
      name: "Xpander Creative 2",
      status: "ACTIVE",
      funnel: "DM",
      branch: "BINTARO",
      verdict: "PAUSE",
      metrics: metrics({ rphLead: 90_000, spend: 500_000 }),
    },
  ],
};

describe("CampaignDetailDrawer", () => {
  it("renders header with name, status, verdict, and ad count", () => {
    render(
      <CampaignDetailDrawer
        target={{ kind: "adset", name: AD_SET.name, stableId: AD_SET.stableId }}
        status={AD_SET.status}
        verdict="SCALE"
        adSet={AD_SET}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("AdSet Bintaro")).toBeInTheDocument();
    expect(screen.getByText("2 ad")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-badge")).toHaveTextContent("SCALE");
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CampaignDetailDrawer
        target={{ kind: "adset", name: AD_SET.name, stableId: AD_SET.stableId }}
        status={AD_SET.status}
        verdict="SCALE"
        adSet={AD_SET}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders real MetricCard components for Blok 2 (no fabricated ROAS/sparkline)", () => {
    render(
      <CampaignDetailDrawer
        target={{ kind: "ad", name: "Xpander Creative 1", stableId: "#C001" }}
        status="ACTIVE"
        verdict="SCALE"
        adSet={AD_SET}
        focusAd={AD_SET.ads[0]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("metric-card").length).toBeGreaterThanOrEqual(6);
  });

  it("shows the amber tracking-parameters note (real, honest 'not configured' finding)", () => {
    render(
      <CampaignDetailDrawer
        target={{ kind: "adset", name: AD_SET.name, stableId: AD_SET.stableId }}
        status={AD_SET.status}
        verdict="SCALE"
        adSet={AD_SET}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tracking-note")).toHaveTextContent(
      "No tracking parameters configured.",
    );
  });

  it("renders Copy Variations from the ad set's own sibling ads, with exactly one WINNING badge", () => {
    render(
      <CampaignDetailDrawer
        target={{ kind: "adset", name: AD_SET.name, stableId: AD_SET.stableId }}
        status={AD_SET.status}
        verdict="SCALE"
        adSet={AD_SET}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("copy-variant-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("winning-badge")).toHaveLength(1);
  });

  it("honestly degrades Audience Breakdown to an empty state (no assetId join available)", () => {
    render(
      <CampaignDetailDrawer
        target={{ kind: "adset", name: AD_SET.name, stableId: AD_SET.stableId }}
        status={AD_SET.status}
        verdict="SCALE"
        adSet={AD_SET}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("audience-breakdown-empty")).toBeInTheDocument();
  });

  it("renders a Launch New Ad link to the real, existing Creative Hub entry point (gap 4)", () => {
    render(
      <CampaignDetailDrawer
        target={{ kind: "adset", name: AD_SET.name, stableId: AD_SET.stableId }}
        status={AD_SET.status}
        verdict="SCALE"
        adSet={AD_SET}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("launch-new-ad-button")).toHaveAttribute(
      "href",
      "/creative?tab=review-kai",
    );
  });
});
