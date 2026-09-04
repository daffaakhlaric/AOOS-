import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiStrip } from "@/components/overview/KpiStrip";
import type { OverviewAgentScoreDto } from "@/types/dashboard.types";

const AGENT_STATUS: readonly OverviewAgentScoreDto[] = [
  {
    agent: "SAMANTHA",
    todayAverageOverall: 80,
    priorSevenDayAverageOverall: 78,
    delta: 2,
    todaySampleSize: 4,
    priorSevenDaySampleSize: 20,
    actionsToday: 3,
  },
  {
    agent: "KAI",
    todayAverageOverall: undefined,
    priorSevenDayAverageOverall: undefined,
    delta: undefined,
    todaySampleSize: 0,
    priorSevenDaySampleSize: 0,
    actionsToday: 0,
  },
  {
    agent: "CLARA",
    todayAverageOverall: 60,
    priorSevenDayAverageOverall: 58,
    delta: 2,
    todaySampleSize: 2,
    priorSevenDaySampleSize: 10,
    actionsToday: 1,
  },
];

describe("KpiStrip", () => {
  it("renders every real value when all sections are present", () => {
    render(
      <KpiStrip
        leads={{ hot: 3, warm: 5, cold: 2, hotToday: 2, hotYesterday: 1, hotDeltaVsYesterday: 1 }}
        campaigns={{
          adAccountId: "act-1",
          datePreset: "last_7d",
          activeCampaignsCount: 2,
          totalCampaignsCount: 3,
          totalSpend: 1_500_000,
          campaigns: [],
        }}
        agentStatus={AGENT_STATUS}
        recycling={{ sentToday: 4, respondedToday: 1, onCooldown: 2 }}
      />,
    );
    expect(screen.getByTestId("kpi-strip")).toBeInTheDocument();
    expect(screen.getByText("+1 dari kemarin")).toBeInTheDocument(); // HOT leads hari ini delta
    expect(screen.getByText(/7 hari terakhir/)).toBeInTheDocument();
    expect(screen.queryByText("Data tidak tersedia")).not.toBeInTheDocument();
  });

  it("shows an honest 'Data tidak tersedia' per section when leads/campaigns/recycling are undefined, never a fabricated 0", () => {
    render(
      <KpiStrip
        leads={undefined}
        campaigns={undefined}
        agentStatus={AGENT_STATUS}
        recycling={undefined}
      />,
    );
    const unavailable = screen.getAllByText("Data tidak tersedia");
    // HOT leads / Leads HOT-WARM-COLD (leads undefined) + Campaign aktif / Spend (campaigns
    // undefined) + Recycling (recycling undefined) = 5 degraded cells; AI score rata-rata still
    // computes real from `agentStatus`.
    expect(unavailable.length).toBe(5);
  });

  it("shows 'belum ada perbandingan' for the AI score cell when no agent has a real delta yet", () => {
    render(
      <KpiStrip
        leads={undefined}
        campaigns={undefined}
        agentStatus={[
          {
            agent: "SAMANTHA",
            todayAverageOverall: 50,
            priorSevenDayAverageOverall: undefined,
            delta: undefined,
            todaySampleSize: 1,
            priorSevenDaySampleSize: 0,
            actionsToday: 1,
          },
        ]}
        recycling={undefined}
      />,
    );
    expect(screen.getByText("belum ada perbandingan")).toBeInTheDocument();
  });
});
