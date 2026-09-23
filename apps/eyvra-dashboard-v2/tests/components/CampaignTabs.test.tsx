import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CampaignTabs } from "@/components/campaigns/CampaignTabs";
import { mapCampaignPortfolioItem, type PortfolioCampaign } from "@/lib/campaigns";
const item = mapCampaignPortfolioItem({
  id: "c",
  metaId: "campaign",
  stableId: "A1",
  name: "Test campaign",
  objective: "LEADS",
  status: "ACTIVE",
  spend: 100,
  dailyBudget: 10,
  accountId: "account",
  accountName: "Account",
  syncedAt: "2026-09-21",
  adSets: [
    {
      id: "s",
      metaId: "s",
      stableId: "B1",
      name: "Ad set",
      status: "ACTIVE",
      spend: 100,
      dailyBudget: 10,
      ads: [
        {
          id: "a",
          metaId: "ad",
          stableId: "C1",
          name: "Real creative",
          status: "ACTIVE",
          verdict: "KEEP",
          metrics: { spend: 100, clicks: 10, impressions: 1000, frequency: 1, totalLead: 2 },
        },
      ],
    },
  ],
} as PortfolioCampaign);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows unassessed instead of fabricating a healthy creative", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
      }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  expect(await screen.findByText("C1 · Real creative")).toBeInTheDocument();
  expect(screen.getByText("Unassessed", { selector: "span" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Winner 0" }));
  expect(screen.getByText("Tidak ada creative sesuai filter")).toBeInTheDocument();
});
it("renders experiment outcomes and related Kai variants from linked records", async () => {
  const data = {
    tests: [
      {
        id: "test",
        campaignId: "campaign",
        name: "Angle test",
        status: "COMPLETE",
        thresholdSpend: 50,
        thresholdDays: 1,
        minMarginPct: 20,
        winnerVariantId: "v",
        variants: [
          {
            id: "v",
            variantLabel: "A",
            angle: "INVESTASI",
            status: "WINNER",
            creativePackageId: "pkg",
            metaAdId: "ad",
            spend: 100,
            leads: 5,
          },
        ],
      },
    ],
    packages: [],
    leads: [],
    activities: [],
    errors: [],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  render(
    <CampaignTabs
      item={item}
      tab="experiments"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
    />,
  );
  expect(await screen.findByText("Angle test")).toBeInTheDocument();
  expect(screen.getByText("Winner selected")).toBeInTheDocument();
});
it("does not turn failed supporting reads into successful zero lead data", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ errors: ["Lead quality belum dapat dimuat."] }),
      }),
  );
  render(
    <CampaignTabs item={item} tab="leads" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  expect(await screen.findByText("Data Clara belum tersedia.")).toBeInTheDocument();
  expect(screen.queryByText("Belum ada lead dengan campaign ID ini.")).not.toBeInTheDocument();
});
