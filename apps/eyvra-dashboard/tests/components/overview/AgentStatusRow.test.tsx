import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentStatusRow } from "@/components/overview/AgentStatusRow";

describe("AgentStatusRow", () => {
  it("renders exactly 3 real agent cards — SAMANTHA/KAI/CLARA, never a 4th Karen card", () => {
    render(
      <AgentStatusRow
        agentStatus={[
          {
            agent: "SAMANTHA",
            todayAverageOverall: 82,
            priorSevenDayAverageOverall: 80,
            delta: 2,
            todaySampleSize: 4,
            priorSevenDaySampleSize: 20,
            actionsToday: 5,
          },
          {
            agent: "KAI",
            todayAverageOverall: 70,
            priorSevenDayAverageOverall: 65,
            delta: 5,
            todaySampleSize: 2,
            priorSevenDaySampleSize: 10,
            actionsToday: 2,
          },
          {
            agent: "CLARA",
            todayAverageOverall: 60,
            priorSevenDayAverageOverall: 58,
            delta: 2,
            todaySampleSize: 3,
            priorSevenDaySampleSize: 15,
            actionsToday: 1,
          },
        ]}
      />,
    );
    expect(screen.getByTestId("agent-status-card-SAMANTHA")).toBeInTheDocument();
    expect(screen.getByTestId("agent-status-card-KAI")).toBeInTheDocument();
    expect(screen.getByTestId("agent-status-card-CLARA")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-status-card-KAREN")).not.toBeInTheDocument();
    expect(screen.queryByText(/KAREN/)).not.toBeInTheDocument();
  });

  it("degrades one agent's card honestly to 'Belum ada skor AI Judge hari ini' when that agent has zero judge_results rows today, without hiding the other 2 real cards", () => {
    render(
      <AgentStatusRow
        agentStatus={[
          {
            agent: "SAMANTHA",
            todayAverageOverall: 82,
            priorSevenDayAverageOverall: 80,
            delta: 2,
            todaySampleSize: 4,
            priorSevenDaySampleSize: 20,
            actionsToday: 5,
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
            todaySampleSize: 3,
            priorSevenDaySampleSize: 15,
            actionsToday: 1,
          },
        ]}
      />,
    );
    expect(screen.getByText("Belum ada skor AI Judge hari ini")).toBeInTheDocument();
    expect(screen.getByTestId("agent-status-card-SAMANTHA")).toBeInTheDocument();
    expect(screen.getByTestId("agent-status-card-CLARA")).toBeInTheDocument();
  });
});
