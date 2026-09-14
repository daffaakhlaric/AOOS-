import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { aggregateVerdict, CampaignTree } from "@/components/meta-ads/CampaignTree";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

function metrics(
  overrides: Partial<CampaignSummaryDto["adSets"][number]["ads"][number]["metrics"]> = {},
) {
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

const CAMPAIGNS: readonly CampaignSummaryDto[] = [
  {
    id: "c1",
    metaId: "c1",
    stableId: "#A001",
    name: "Meta-DM-Leads-Mobix",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 2_000_000,
    adSets: [
      {
        id: "as1",
        metaId: "as1",
        stableId: "#B001",
        name: "AdSet Bintaro",
        status: "ACTIVE",
        spend: 2_000_000,
        ads: [
          {
            id: "ad1",
            metaId: "ad1",
            stableId: "#C001",
            name: "Xpander Creative 1",
            status: "ACTIVE",
            funnel: "DM",
            branch: "BINTARO",
            verdict: "SCALE",
            metrics: metrics(),
          },
          {
            id: "ad2",
            metaId: "ad2",
            stableId: "#C002",
            name: "Xpander Creative 2",
            status: "ACTIVE",
            funnel: "DM",
            branch: "BINTARO",
            verdict: "PAUSE",
            metrics: metrics({ spend: 500_000 }),
          },
        ],
      },
    ],
  },
];

describe("aggregateVerdict", () => {
  it("picks FIX above every other verdict", () => {
    expect(aggregateVerdict(["KEEP", "FIX", "SCALE"])).toBe("FIX");
  });

  it("picks PAUSE above SCALE/REFRESH/KEEP/REVIEW", () => {
    expect(aggregateVerdict(["KEEP", "PAUSE", "SCALE"])).toBe("PAUSE");
  });

  it("picks SCALE above REFRESH/KEEP/REVIEW", () => {
    expect(aggregateVerdict(["REVIEW", "SCALE", "KEEP"])).toBe("SCALE");
  });

  it("falls back to REVIEW for an empty list", () => {
    expect(aggregateVerdict([])).toBe("REVIEW");
  });
});

describe("CampaignTree", () => {
  it("renders the campaign → ad-set → ad hierarchy with real stableIds", async () => {
    // TOTAL UI REBUILD spec's "ID badge" is its own bordered/mono chip element (spec "=== CAMPAIGN
    // CARDS === ID badge"), so the id and the name are now separate DOM text nodes rather than one
    // combined string — asserted separately here instead of via one combined regex.
    // FIX 2 (campaign-card UI rebuild follow-up): THREE independent collapse levels now — the
    // ad-set row only appears once the campaign is expanded, and the individual ad rows only
    // appear once that ad set is ALSO expanded (both default collapsed).
    render(<CampaignTree campaigns={CAMPAIGNS} search="" onExecute={vi.fn()} />);
    expect(screen.getByText("#A001")).toBeInTheDocument();
    expect(screen.getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Meta-DM-Leads-Mobix/ }));
    expect(screen.getByText("#B001")).toBeInTheDocument();
    expect(screen.getByText("AdSet Bintaro")).toBeInTheDocument();
    expect(screen.queryByText("#C001")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /AdSet Bintaro/ }));
    expect(screen.getByText("#C001")).toBeInTheDocument();
    expect(screen.getByText("Xpander Creative 1")).toBeInTheDocument();
    expect(screen.getByText("#C002")).toBeInTheDocument();
    expect(screen.getByText("Xpander Creative 2")).toBeInTheDocument();
  });

  it("strips a UUID suffix from campaign/ad-set names too, not just ad names (FIX 1)", async () => {
    const campaignsWithUuidNames: readonly CampaignSummaryDto[] = [
      {
        ...CAMPAIGNS[0]!,
        name: "Meta-DM-Leads-Mobix - platinum - Boost 019f94fd-8841-7dd0-abf9-5d65888159bd",
        adSets: [
          {
            ...CAMPAIGNS[0]!.adSets[0]!,
            name: "AdSet Bintaro - Boost 3fa85f64-5717-4562-b3fc-2c963f66afa6",
          },
        ],
      },
    ];
    render(<CampaignTree campaigns={campaignsWithUuidNames} search="" onExecute={vi.fn()} />);
    expect(screen.getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Meta-DM-Leads-Mobix/ }));
    expect(screen.getByText("AdSet Bintaro")).toBeInTheDocument();
  });

  it("only shows an ad's funnel strip once that ad row itself is expanded (FIX 4)", async () => {
    render(<CampaignTree campaigns={CAMPAIGNS} search="" onExecute={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Meta-DM-Leads-Mobix/ }));
    await userEvent.click(screen.getByRole("button", { name: /AdSet Bintaro/ }));
    // The ad row itself (name/metrics/Execute) is already visible — only the funnel is gated.
    expect(screen.getByText("Xpander Creative 1")).toBeInTheDocument();
    expect(screen.queryAllByTestId("campaign-funnel-bar")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /Xpander Creative 1/ }));
    expect(screen.getAllByTestId("campaign-funnel-bar")).toHaveLength(1);
  });

  it("shows the campaign's aggregated verdict (PAUSE, the highest-priority real per-ad verdict present) as its badge", () => {
    render(<CampaignTree campaigns={CAMPAIGNS} search="" onExecute={vi.fn()} />);
    const badges = screen.getAllByTestId("verdict-badge");
    expect(badges[0]?.textContent).toBe("⏸PAUSE");
  });

  it("calls onExecute with the ad's own real verdict when its Execute button is clicked", async () => {
    const onExecute = vi.fn();
    render(<CampaignTree campaigns={CAMPAIGNS} search="" onExecute={onExecute} />);
    // Cards start collapsed at every level, so the ad-level Execute buttons only exist once both
    // the campaign AND its ad set are expanded (FIX 2's three independent collapse levels).
    await userEvent.click(screen.getByRole("button", { name: /Meta-DM-Leads-Mobix/ }));
    await userEvent.click(screen.getByRole("button", { name: /AdSet Bintaro/ }));
    const executeButtons = screen.getAllByRole("button", { name: /Execute/ });
    // executeButtons[0] is the campaign-level button; [1] is ad1 (SCALE), [2] is ad2 (PAUSE).
    await userEvent.click(executeButtons[1]!);
    expect(onExecute).toHaveBeenCalledWith("ad1", "ad", "SCALE");
  });

  it("filters to only campaigns/ad-sets/ads matching the search query (matched campaign/ad-set auto-expand)", () => {
    render(<CampaignTree campaigns={CAMPAIGNS} search="Creative 1" onExecute={vi.fn()} />);
    expect(screen.getByText("Xpander Creative 1")).toBeInTheDocument();
    expect(screen.queryByText("Xpander Creative 2")).not.toBeInTheDocument();
  });

  it("shows 'Tidak ada hasil' when the search matches nothing", () => {
    render(<CampaignTree campaigns={CAMPAIGNS} search="nonexistent-xyz" onExecute={vi.fn()} />);
    expect(screen.getByText("Tidak ada hasil")).toBeInTheDocument();
  });

  it("shows 'Belum ada data iklan' when there are no campaigns at all (no search active)", () => {
    render(<CampaignTree campaigns={[]} search="" onExecute={vi.fn()} />);
    expect(screen.getByText("Belum ada data iklan")).toBeInTheDocument();
  });
});
