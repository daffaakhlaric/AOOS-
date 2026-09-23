// Test-only visual harness. Not imported by any production route.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CampaignTabs } from "@/components/campaigns/CampaignTabs";
import { mapCampaignPortfolioItem } from "@/lib/campaigns";
import { accountSummaryFixture } from "./fixtures";
import "@/app/globals.css";
const packageData = {
  id: "pkg",
  briefId: "brief",
  adId: "ad",
  title: "Location concept",
  status: "PENDING",
  fatigueStatus: "WARNING",
  angle: "INVESTASI",
  primaryMessage: "Location concept test",
  createdAt: "2026-09-21",
  copyVariants: [
    {
      id: "copy",
      variantLabel: "A",
      headline: "Explore this property",
      primaryText: "Test copy for layout validation",
    },
  ],
};
window.fetch = async () =>
  new Response(
    JSON.stringify({
      leads: [
        {
          id: "lead-one",
          status: "HOT",
          temperature: "HOT",
          score: 85,
          createdAt: "2026-09-20",
          qualifiedAt: "2026-09-20",
          contacted: true,
        },
      ],
      tests: [
        {
          id: "test",
          campaignId: "campaign",
          name: "Location vs lifestyle",
          status: "RUNNING",
          thresholdSpend: 100000,
          thresholdDays: 3,
          minMarginPct: 20,
          startedAt: "2026-09-19",
          variants: [
            {
              id: "variant",
              variantLabel: "A",
              angle: "INVESTASI",
              creativePackageId: "pkg",
              metaAdId: "ad",
              status: "RUNNING",
              spend: 40000,
              leads: 3,
            },
          ],
        },
      ],
      packages: [packageData],
      activities: [
        {
          id: "event",
          agent: "SAMANTHA",
          actionType: "CREATIVE_REFRESH",
          status: "SIMULATED",
          mode: "DEV",
          createdAt: "2026-09-21",
          startedAt: "2026-09-21",
          reasoning: "Test annotation",
          toolCalls: [],
        },
      ],
      errors: [],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
const item = mapCampaignPortfolioItem(
  {
    id: "campaign",
    metaId: "campaign",
    stableId: "A1",
    name: "Campaign layout fixture",
    status: "ACTIVE",
    objective: "LEADS",
    dailyBudget: 500000,
    spend: 1800000,
    accountId: "test",
    accountName: "Test account",
    syncedAt: "2026-09-21",
    adSets: [
      {
        id: "s",
        metaId: "s",
        stableId: "B1",
        name: "Prospecting",
        status: "ACTIVE",
        spend: 1800000,
        dailyBudget: 500000,
        ads: [
          {
            id: "ad",
            metaId: "ad",
            stableId: "C014",
            name: "Location creative",
            status: "ACTIVE",
            verdict: "REFRESH",
            metrics: {
              spend: 1800000,
              clicks: 180,
              impressions: 18000,
              totalLead: 30,
              frequency: 2.7,
            },
          },
        ],
      },
    ],
  },
  accountSummaryFixture.campaigns[0],
);
function App() {
  const [tab, setTab] = useState("overview");
  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "auto" }}>
      <h1>Campaign tabs — layout test fixture</h1>
      <p>NOT LIVE ACCOUNT DATA</p>
      <nav style={{ display: "flex", gap: 16, margin: "20px 0", flexWrap: "wrap" }}>
        {[
          "overview",
          "performance",
          "creative",
          "leads",
          "budget",
          "experiments",
          "history",
          "kai",
        ].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              color: tab === t ? "#7c3aed" : "#667085",
              borderBottom: tab === t ? "2px solid #7c3aed" : "none",
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      <CampaignTabs
        item={item}
        tab={tab}
        onTab={setTab}
        history={[1, 2, 3, 4, 5, 6, 7].map((i) => ({
          date: `2026-09-${14 + i}`,
          spend: 150000 + i * 13000,
          leads: i + 2,
          ctr: 0.01 + i * 0.002,
          cpl: 30000,
          clicks: i * 10,
          impressions: i * 1000,
        }))}
        historyError={false}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
