import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandCenterClient } from "@/components/command-center/CommandCenterClient";
import type { AccountSummaryResponseDto, OverviewResponseDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

const emptyGrowthObjectives = { objectives: [] };
const emptyTimeseries = { tenantId: "t1", points: [] };
const emptyAbTesting = { tests: [] };
const emptyCreative = { packages: [] };

/**
 * Real fixture shape mirroring `AccountSummaryResponseDto` — `GET /api/campaign-health/account-summary`'s
 * real response (the real, account-wide Samantha V2 aggregate: `CampaignHealth`/`CampaignDiagnosis`/
 * `SamanthaDecision`/`Opportunity` — NOT the legacy per-ad `Verdict`). `overallStatus`/dimension
 * statuses are real per `campaign-health.ts`'s own domain shape; `audience`/`tracking`/`leadQuality`
 * are honestly `UNKNOWN` (this codebase never fabricates those 3).
 */
const accountSummaryFixture: AccountSummaryResponseDto = {
  tenantId: "dss-motor",
  generatedAt: new Date().toISOString(),
  campaignsAnalyzed: 1,
  campaignsCapped: false,
  campaigns: [
    {
      campaignId: "meta-c1",
      campaignName: "Campaign Fix Me",
      spend: 1_500_000,
      health: {
        delivery: {
          status: "WATCH",
          score: 60,
          confidence: 0.6,
          issues: ["Data sufficiency masih LOW."],
        },
        costEfficiency: { status: "HEALTHY", score: 90, confidence: 0.9, issues: [] },
        creative: {
          status: "CRITICAL",
          score: 20,
          confidence: 0.73,
          issues: ["CTR turun 50% dibanding baseline."],
        },
        audience: {
          status: "UNKNOWN",
          confidence: 0,
          issues: ["Data audience-saturation belum tersedia."],
        },
        conversion: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
        tracking: {
          status: "UNKNOWN",
          confidence: 0,
          issues: ["Data tracking/pixel-health belum tersedia."],
        },
        leadQuality: { status: "UNKNOWN", confidence: 0, issues: ["Data CPQL belum tersedia."] },
        overallStatus: "CRITICAL",
      },
      diagnosis: {
        rootCause: "CREATIVE_FATIGUE",
        confidence: 0.73,
        impact: "HIGH",
        evidence: [
          {
            type: "CREATIVE_FATIGUE",
            severity: "HIGH",
            metric: "ctr",
            currentValue: 0.0091,
            baselineValue: 0.0182,
            deltaPct: -0.5,
            confidence: 0.73,
            reasoning: "CTR turun 50% dibanding baseline.",
          },
        ],
        contributingFactors: [],
        recommendedFocus: ["creative"],
      },
      decision: {
        decision: "REQUEST_KAI_CREATIVE",
        primaryDiagnosis: "CREATIVE_FATIGUE",
        confidence: 0.73,
        impact: "HIGH",
        reason:
          "Root cause CREATIVE_FATIGUE terdeteksi (confidence 73%) — creative existing kemungkinan sudah jenuh.",
        riskOfDoingNothing: "CTR dan performa creative berpotensi terus menurun.",
        expectedOutcome: "Creative baru dari Kai berpotensi memulihkan CTR.",
        monitoringPlan: {
          reviewAfterHours: 48,
          successConditions: [
            "Dimensi creative kembali ke status Healthy setelah creative baru dari Kai tayang.",
          ],
          rollbackConditions: [
            "Creative baru dari Kai tidak memperbaiki dimensi creative dalam periode review.",
          ],
        },
      },
    },
  ],
  opportunities: [
    {
      type: "CREATIVE_WINNER_EXPANSION",
      confidence: 0.9,
      description:
        'Angle "family-friendly" adalah performer terbaik saat ini (rank 1) — pertimbangkan meminta lebih banyak variasi creative dengan angle ini ke Kai.',
      evidence:
        'Angle "family-friendly" memiliki CPL Rp50000 dari 3 creative package dengan data sufficiency HIGH.',
    },
  ],
  errors: {},
};

function mockFetchRouting(
  overviewResponse: () => Response,
  accountSummaryResponse: () => Response = () => jsonResponse(accountSummaryFixture),
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/overview/timeseries")) {
        return Promise.resolve(jsonResponse(emptyTimeseries));
      }
      if (url.startsWith("/api/overview")) {
        return Promise.resolve(overviewResponse());
      }
      if (url.startsWith("/api/growth-objectives")) {
        return Promise.resolve(jsonResponse(emptyGrowthObjectives));
      }
      if (url.startsWith("/api/abtesting")) {
        return Promise.resolve(jsonResponse(emptyAbTesting));
      }
      if (url.startsWith("/api/creative")) {
        return Promise.resolve(jsonResponse(emptyCreative));
      }
      if (url.startsWith("/api/campaign-health/account-summary")) {
        return Promise.resolve(accountSummaryResponse());
      }
      return Promise.resolve(jsonResponse({}, false));
    }),
  );
}

/**
 * `overview.campaigns.campaigns[0].adSets[0].ads[0].verdict` is `"FIX"` — a real legacy ad-level
 * `Verdict`, deliberately NEVER `"SCALE"` anywhere in this fixture. If Needs Attention/
 * Opportunities/Decision Queue still derived from the old `computeCampaignVerdicts` aggregation,
 * Opportunities would show 0 (no `SCALE` ad) and Needs Attention's count/root-cause breakdown
 * would not exist. Both instead come entirely from `accountSummaryFixture` — proving the legacy
 * path is gone.
 */
const baseOverview: OverviewResponseDto = {
  tenantId: "dss-motor",
  generatedAt: new Date().toISOString(),
  leads: { hot: 12, warm: 5, cold: 3, hotToday: 2, hotYesterday: 1, hotDeltaVsYesterday: 1 },
  campaigns: {
    adAccountId: "act_1",
    datePreset: "last_30d",
    activeCampaignsCount: 2,
    totalCampaignsCount: 2,
    totalSpend: 2_500_000,
    campaigns: [
      {
        id: "c1",
        metaId: "meta-c1",
        stableId: "s1",
        name: "Campaign Fix Me",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        spend: 1_500_000,
        dailyBudget: 100_000,
        adSets: [
          {
            id: "as1",
            metaId: "am1",
            stableId: "as-s1",
            name: "AdSet 1",
            status: "ACTIVE",
            spend: 1_500_000,
            dailyBudget: 100_000,
            ads: [
              {
                id: "ad1",
                metaId: "adm1",
                stableId: "ad-s1",
                name: "Ad 1",
                status: "ACTIVE",
                verdict: "FIX",
                metrics: { spend: 1_500_000, clicks: 40, frequency: 2, totalLead: 3 },
              },
            ],
          },
        ],
      },
    ],
  },
  agentStatus: [
    {
      agent: "SAMANTHA",
      todayAverageOverall: 8.2,
      todaySampleSize: 5,
      priorSevenDaySampleSize: 20,
      actionsToday: 4,
    },
    { agent: "KAI", todaySampleSize: 0, priorSevenDaySampleSize: 0, actionsToday: 0 },
    { agent: "CLARA", todaySampleSize: 0, priorSevenDaySampleSize: 0, actionsToday: 1 },
  ],
  activities: [],
  insight: { available: false, reason: "NO_API_KEY", message: "LLM unavailable" },
  errors: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CommandCenterClient", () => {
  it("shows a real loading state before data arrives", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    render(<CommandCenterClient />);
    expect(screen.getByTestId("command-center-loading")).toBeInTheDocument();
  });

  it("shows a real error state when /api/overview fails", async () => {
    mockFetchRouting(() => jsonResponse({ error: { message: "Unauthorized" } }, false));
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center-error")).toBeInTheDocument());
  });

  it("renders every real section once data arrives, with honest empty states where there is genuinely nothing", async () => {
    mockFetchRouting(() => jsonResponse(baseOverview));
    render(<CommandCenterClient />);

    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());

    // Growth Objective Hero — real, honest empty state (no objective seeded in this test).
    expect(await screen.findByText("🎯 Set your Growth Objective")).toBeInTheDocument();

    // KPI strip — real values for Spend/Raw Leads/Hot Leads/CPL.
    expect(screen.getByTestId("cc-kpi-spend")).toHaveTextContent("Rp");
    expect(screen.getByTestId("cc-kpi-raw-leads")).toHaveTextContent("3");
    expect(screen.getByTestId("cc-kpi-hot-leads")).toHaveTextContent("12");

    // Needs Attention — real account-wide aggregate from the NEW `account-summary` endpoint, not
    // the legacy ad-verdict count (the overview fixture's own single ad verdict is "FIX", but
    // Needs Attention's real count/root-cause line trace to `accountSummaryFixture` instead).
    // Card restructured to the reference layout this round ([dot] [value] [label] / [sub-line]),
    // so the value and label are now separate elements — the assertions below still pin the SAME
    // real numbers from `accountSummaryFixture` (0 CRITICAL, 1 HIGH, 1 CREATIVE_FATIGUE).
    const attentionPanel = await screen.findByTestId("cc-panel-attention");
    expect(attentionPanel).toHaveTextContent("1 items");
    expect(attentionPanel).toHaveTextContent("Critical campaigns");
    expect(attentionPanel).toHaveTextContent("Creative fatigue");
    expect(attentionPanel).toHaveTextContent("1 high impact");
    // Tracking has no real source in this codebase — it must stay an honest em-dash, never a "0".
    expect(attentionPanel).toHaveTextContent("Tracking issues");

    // Opportunities — real CREATIVE_WINNER_EXPANSION count from the Opportunity Engine, sourced
    // from `accountSummaryFixture.opportunities`, NEVER from an ad-level `verdict === "SCALE"`
    // count (there is no SCALE verdict anywhere in `baseOverview`).
    const opportunityPanel = await screen.findByTestId("cc-panel-opportunity");
    expect(opportunityPanel).toHaveTextContent("1");
    expect(opportunityPanel).toHaveTextContent("Winning concepts");
    expect(opportunityPanel.querySelector("[title]")).toHaveAttribute(
      "title",
      expect.stringContaining("family-friendly"),
    );

    // Samantha Decision Queue — real diagnosis card for the real actionable campaign, from the
    // real account-summary fixture (never a raw verdict table).
    expect(await screen.findByTestId("cc-decision-queue")).toBeInTheDocument();
    expect(screen.getByText("Campaign Fix Me")).toBeInTheDocument();
    // The row's grey sub-line is the real highest-severity `diagnosis.evidence[].reasoning` string,
    // verbatim from the fixture (reference-design pass: the row used to show the root-cause LABEL
    // here; the root cause itself is still asserted inside the Evidence drawer below).
    expect(screen.getByTestId("decision-subline-meta-c1")).toHaveTextContent(
      "CTR turun 50% dibanding baseline.",
    );
    expect(screen.getByTestId("decision-confidence-meta-c1")).toHaveTextContent("73%");

    // Real 7-dimension health badges — moved behind the `[Evidence]` expand toggle this round (the
    // Decision Queue's density rebuild); open it to reach them. Every dimension renders its real
    // status, `UNKNOWN` dimensions (audience/tracking/leadQuality) included and never fabricated as
    // something else.
    fireEvent.click(screen.getByRole("button", { name: "View Evidence" }));
    // The real root cause (`diagnosis.rootCause: CREATIVE_FATIGUE`) still renders, now as the
    // drawer's own heading.
    expect(screen.getAllByText("Creative Fatigue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("decision-health-meta-c1-delivery")).toHaveAttribute(
      "data-status",
      "WATCH",
    );
    expect(screen.getByTestId("decision-health-meta-c1-costEfficiency")).toHaveAttribute(
      "data-status",
      "HEALTHY",
    );
    expect(screen.getByTestId("decision-health-meta-c1-creative")).toHaveAttribute(
      "data-status",
      "CRITICAL",
    );
    expect(screen.getByTestId("decision-health-meta-c1-audience")).toHaveAttribute(
      "data-status",
      "UNKNOWN",
    );
    expect(screen.getByTestId("decision-health-meta-c1-conversion")).toHaveAttribute(
      "data-status",
      "HEALTHY",
    );
    expect(screen.getByTestId("decision-health-meta-c1-tracking")).toHaveAttribute(
      "data-status",
      "UNKNOWN",
    );
    expect(screen.getByTestId("decision-health-meta-c1-leadQuality")).toHaveAttribute(
      "data-status",
      "UNKNOWN",
    );

    // Performance Overview — honest "not enough data" empty state (0 real timeseries points).
    expect(await screen.findByText("Belum cukup data historis")).toBeInTheDocument();

    // AI Team Pulse — real per-agent one-line summaries (replaces the old stacked AiTeamStatus in
    // this grid slot; AiTeamStatus.tsx itself is untouched/unused, not deleted).
    expect(screen.getByTestId("cc-ai-team-pulse")).toBeInTheDocument();
    expect(screen.getAllByText("Samantha").length).toBeGreaterThan(0);

    // Active Experiments / Kai Production — real, honest empty states.
    expect(await screen.findByText("Tidak ada eksperimen aktif")).toBeInTheDocument();
    expect(await screen.findByText("Belum ada creative package")).toBeInTheDocument();

    // Recent Agent Activity — real, honest empty state (0 activities in this fixture).
    expect(screen.getByText("Belum ada aktivitas agent")).toBeInTheDocument();
  });

  it("never renders a fabricated CPQL/Booking number, and only ever renders a confidence/plan that traces to the real account-summary fixture", async () => {
    mockFetchRouting(() => jsonResponse(baseOverview));
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());

    const cpql = screen.getByTestId("cc-kpi-cpql");
    const booking = screen.getByTestId("cc-kpi-booking");
    // The honest unavailable state renders an em-dash, never a currency/number value.
    expect(cpql).toHaveTextContent("—");
    expect(cpql).toHaveTextContent(/data unavailable/i);
    expect(booking).toHaveTextContent("—");
    expect(booking).toHaveTextContent(/data unavailable/i);
    expect(cpql.textContent).not.toMatch(/Rp\s?\d/);
    expect(booking.textContent).not.toMatch(/Rp\s?\d/);

    // The Decision Queue's confidence/plan text is real — it must equal EXACTLY the fixture's own
    // `decision.confidence`/`decision.reason`/`monitoringPlan.successConditions`/`reviewAfterHours`
    // values, never a paraphrased or invented number/sentence.
    await screen.findByTestId("cc-decision-queue");
    expect(screen.getByTestId("decision-confidence-meta-c1")).toHaveTextContent("73%");
    // The row's `Samantha Plan` lines are the fixture's own real
    // `monitoringPlan.successConditions` strings, verbatim — never invented action phrasing like
    // "Generate 6 new creatives" (no field in this codebase says that).
    expect(screen.getByTestId("decision-card-meta-c1")).toHaveTextContent(
      "Dimensi creative kembali ke status Healthy setelah creative baru dari Kai tayang.",
    );
    expect(screen.getByTestId("decision-card-meta-c1").textContent).not.toMatch(
      /Generate \d+ new creatives/,
    );
    fireEvent.click(screen.getByRole("button", { name: "View Evidence" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Dimensi creative kembali ke status Healthy setelah creative baru dari Kai tayang.",
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Review ulang dalam 48 jam.")).toBeInTheDocument();
    // The evidence row's real before->after CTR values/delta come from the SAME fixture, verbatim —
    // formatted as a real percentage (1.82% -> 0.91%), not the raw 0.0182/0.0091 fraction.
    expect(screen.getAllByText(/1\.82%.*0\.91%/).length).toBeGreaterThan(0);
    expect(screen.getByText(/↓50%/)).toBeInTheDocument();
  });

  it("shows a real, honest error inline in Needs Attention/Opportunities/Decision Queue when /api/campaign-health/account-summary fails — independent of whether /api/overview's own campaigns section succeeded", async () => {
    mockFetchRouting(
      () => jsonResponse(baseOverview),
      () => jsonResponse({ error: { message: "Samantha assessment service unavailable" } }, false),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());

    // KPI strip still renders its real overview-sourced numbers — these 2 real data sources are
    // genuinely independent now (the account-summary endpoint never blocks the KPI strip, and vice
    // versa).
    expect(screen.getByTestId("cc-kpi-spend")).toHaveTextContent("Rp");

    await waitFor(() =>
      expect(screen.getAllByText("Samantha assessment service unavailable").length).toBeGreaterThan(
        0,
      ),
    );
  });

  it("shows the real campaign-not-loaded error inline on the KPI/campaigns side even when the account-summary endpoint succeeds independently", async () => {
    mockFetchRouting(() =>
      jsonResponse({
        ...baseOverview,
        campaigns: undefined,
        errors: { campaigns: "Meta Ads token expired" },
      }),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());
    expect(screen.getByTestId("cc-kpi-spend")).toHaveTextContent("Data spend belum tersedia");

    // Needs Attention / Opportunities / Decision Queue are unaffected — they never depended on
    // `overview.campaigns` in the first place, only on the real account-summary aggregate.
    const attentionPanel = await screen.findByTestId("cc-panel-attention");
    expect(attentionPanel).toHaveTextContent("Creative fatigue");
    const opportunityPanel = await screen.findByTestId("cc-panel-opportunity");
    expect(opportunityPanel.querySelector("[title]")).toHaveAttribute(
      "title",
      expect.stringContaining("family-friendly"),
    );
  });
});
