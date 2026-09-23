// Isolated test harness. Never imported by a production route or API.
import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/layout/AppShell";
import { Topbar } from "@/components/layout/Topbar";
import { CommandCenterClient } from "@/components/command-center/CommandCenterClient";
import { accountSummaryFixture, baseOverview } from "./fixtures";
import "@/app/globals.css";
import "@/app/tremor.css";
const empty = new URLSearchParams(location.search).has("empty");
const fixture = {
  ...accountSummaryFixture,
  campaignsAnalyzed: empty ? 0 : 4,
  campaigns: empty
    ? []
    : [0, 1, 2, 3].map((index) => ({
        ...accountSummaryFixture.campaigns[0]!,
        diagnosis: {
          ...accountSummaryFixture.campaigns[0]!.diagnosis,
          evidence: [
            ...accountSummaryFixture.campaigns[0]!.diagnosis.evidence,
            {
              type: "CPL_SPIKE",
              metric: "cpl",
              severity: "HIGH",
              currentValue: 41000,
              baselineValue: 29000,
              deltaPct: 0.41,
              confidence: 0.73,
              reasoning: "Test cost signal",
            },
          ],
        },
        campaignId: `test-${index}`,
        campaignName: [
          "BSD Land · Creative refresh",
          "Promono · Ruko PIK 2",
          "Kedoya · Campaign review",
          "Campaign monitoring",
        ][index]!,
      })),
  opportunities: empty ? [] : accountSummaryFixture.opportunities,
};
const activities = empty
  ? []
  : [
      "EXECUTE_VERDICT",
      "CREATIVE_GENERATED",
      "CREATIVE_BRIEF_CREATED",
      "FATIGUE_DETECTED",
      "CREATIVE_REFRESH_REQUIRED",
    ].map((actionType, index) => ({
      id: `event-${index}`,
      agent: index % 2 ? "KAI" : "SAMANTHA",
      actionType,
      status: "SIMULATED",
      mode: "SIMULATED",
      toolCalls: [],
      createdAt: "2026-09-21T07:30:00Z",
      startedAt: "2026-09-21T07:30:00Z",
    }));
window.fetch = async (input) => {
  const url = String(input);
  const body = url.includes("timeseries")
    ? {
        points: empty
          ? []
          : [1, 2, 3, 4, 5, 6, 7].map((day) => ({
              date: `2026-09-${day + 10}`,
              totalSpend: day * 230000,
              totalLeads: day * 4,
            })),
      }
    : url.includes("account-summary")
      ? fixture
      : url.includes("overview")
        ? { ...baseOverview, activities }
        : url.includes("growth-objectives")
          ? {
              objectives: empty
                ? []
                : [
                    {
                      id: "fixture-goal",
                      status: "ON_TRACK",
                      automationMode: "AUTOPILOT_GUARDED",
                      targetValue: 50,
                      startDate: "2026-09-01",
                      endDate: "2026-09-30",
                      updatedAt: "2026-09-21",
                      progress: {
                        actualValue: 38,
                        percentComplete: 0.76,
                        daysRemaining: 9,
                        currentDailyPace: 1.5,
                        requiredDailyPace: 1.2,
                        onTrack: true,
                      },
                      forecast: { achievableHotLeads: { low: 48, high: 53 } },
                    },
                  ],
            }
          : url.includes("creative")
            ? {
                packages: empty
                  ? []
                  : ["APPROVED", "APPROVED", "PENDING", "GENERATING"].map((status, index) => ({
                      id: `C0${index + 1}`,
                      title: `Concept ${index + 1}`,
                      status,
                      requestedFormat: "Image",
                      createdAt: "2026-09-21",
                    })),
              }
            : url.includes("abtesting")
              ? {
                  tests: empty
                    ? []
                    : [
                        {
                          id: "test",
                          name: "Price vs Location vs Lifestyle",
                          status: "RUNNING",
                          variants: ["Control", "Variant A", "Variant B"].map((label) => ({
                            id: label,
                            variantLabel: label,
                          })),
                        },
                      ],
                }
              : { actions: [] };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
createRoot(document.getElementById("root")!).render(
  <>
    <div
      style={{
        position: "fixed",
        bottom: 3,
        right: 10,
        zIndex: 100,
        fontSize: 11.5,
        color: "#667085",
        background: "white",
      }}
    >
      LAYOUT TEST FIXTURE · Not live account data
    </div>
    <AppShell>
      <main>
        <Topbar
          title="Samantha Command Center"
          subtitle="Your AI advertising team is operating your account."
          userEmail="preview@example.test"
        />
        <CommandCenterClient />
      </main>
    </AppShell>
  </>,
);
