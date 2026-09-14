import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SamanthaInsightBar } from "@/components/campaigns/SamanthaInsightBar";
import type { AdMetricsDto, AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

function metrics(overrides: Partial<AdMetricsDto> = {}): AdMetricsDto {
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

function ad(overrides: Partial<AdSummaryDto> = {}): AdSummaryDto {
  return {
    id: "ad-1",
    metaId: "ad-1",
    stableId: "#C001",
    name: "Ad 1",
    status: "ACTIVE",
    funnel: "DM",
    branch: "BINTARO",
    verdict: "SCALE",
    metrics: metrics(),
    ...overrides,
  };
}

function campaignWith(id: string, verdict: string, frequency = 1.0): CampaignSummaryDto {
  return {
    id,
    metaId: id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 1_000_000,
    adSets: [
      {
        id: `as-${id}`,
        metaId: `as-${id}`,
        stableId: `#B-${id}`,
        name: "AdSet",
        status: "ACTIVE",
        spend: 1_000_000,
        ads: [ad({ id: `ad-${id}`, verdict, metrics: metrics({ frequency }) })],
      },
    ],
  };
}

describe("SamanthaInsightBar", () => {
  it("shows an honest empty message when there are no campaigns yet", () => {
    render(<SamanthaInsightBar campaigns={[]} />);
    expect(screen.getByTestId("samantha-insight-bar")).toHaveTextContent("Belum ada data campaign");
  });

  it("summarizes real SCALE/PAUSE counts computed from aggregateVerdict, not a fabricated narrative", () => {
    render(
      <SamanthaInsightBar
        campaigns={[
          campaignWith("a", "SCALE"),
          campaignWith("b", "PAUSE"),
          campaignWith("c", "KEEP"),
        ]}
      />,
    );
    const bar = screen.getByTestId("samantha-insight-bar");
    expect(bar).toHaveTextContent("3 campaign aktif");
    expect(bar).toHaveTextContent("1 campaign SCALE-worthy");
    expect(bar).toHaveTextContent("1 campaign butuh perhatian");
  });

  it("flags real frequency-jenuh campaigns using the same 3.5 threshold as the table", () => {
    render(<SamanthaInsightBar campaigns={[campaignWith("a", "KEEP", 4.0)]} />);
    expect(screen.getByTestId("samantha-insight-bar")).toHaveTextContent("audiens jenuh");
  });

  it("says everything is stable when nothing is actionable", () => {
    render(<SamanthaInsightBar campaigns={[campaignWith("a", "KEEP", 1.0)]} />);
    expect(screen.getByTestId("samantha-insight-bar")).toHaveTextContent("Semua campaign stabil");
  });
});
