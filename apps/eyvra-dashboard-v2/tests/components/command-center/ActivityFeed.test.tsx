import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityFeed } from "@/components/command-center/ActivityFeed";
import type { ActivityDto } from "@/types/dashboard.types";

function activity(
  overrides: Partial<ActivityDto> & { readonly id: string; readonly createdAt: string },
): ActivityDto {
  return {
    agent: "SAMANTHA",
    actionType: "EXECUTE_VERDICT",
    mode: "AUTOPILOT_GUARDED",
    status: "SUCCESS",
    toolCalls: [],
    startedAt: overrides.createdAt,
    ...overrides,
  };
}

/** Today in Asia/Jakarta, at a fixed time of day so the row's real `HH.mm` is deterministic. */
function todayJakartaIso(hour: number, minute: number): string {
  const now = new Date();
  const jakartaDay = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(now);
  return `${jakartaDay}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`;
}

describe("ActivityFeed", () => {
  it("renders a real date-group heading derived from the entries' own createdAt, never a hardcoded date", () => {
    render(
      <ActivityFeed
        activities={[
          activity({ id: "a1", createdAt: todayJakartaIso(18, 32) }),
          activity({
            id: "a2",
            createdAt: "2026-09-18T10:05:00+07:00",
            agent: "KAI",
            actionType: "CREATIVE_GENERATED",
          }),
        ]}
      />,
    );

    const headings = screen
      .getAllByTestId("cc-activity-date-group")
      .map((node) => node.textContent);
    // One heading per real calendar date, "Today, D MMM" for today's group only.
    expect(headings).toHaveLength(2);
    expect(headings[0]).toMatch(/^Today, \d{1,2} /);
    expect(headings[1]).toBe("18 Sep");
    // Real time column, in Asia/Jakarta.
    expect(screen.getByText("18.32")).toBeInTheDocument();
    expect(screen.getByText("10.05")).toBeInTheDocument();
  });

  it("never renders a raw enum as primary text, and shows the real reasoning as the third line", () => {
    render(
      <ActivityFeed
        activities={[
          activity({
            id: "a1",
            createdAt: todayJakartaIso(9, 15),
            actionType: "FATIGUE_DETECTED",
            status: "SIMULATED",
            reasoning: "Klik menurun 50% dibanding baseline.",
          }),
        ]}
      />,
    );

    const feed = screen.getByTestId("cc-activity-feed");
    // Bold agent name, human-readable action label, real reasoning as the muted third line.
    expect(feed).toHaveTextContent("Samantha");
    expect(screen.getByText("Creative fatigue terdeteksi")).toBeInTheDocument();
    expect(screen.getByText("Klik menurun 50% dibanding baseline.")).toBeInTheDocument();
    expect(screen.getByText("Simulasi")).toBeInTheDocument();
    // No raw enum token anywhere in the rendered timeline.
    expect(feed.textContent).not.toMatch(/FATIGUE_DETECTED|SIMULATED|SAMANTHA/);
  });

  it("keeps the real agent filter behaviour, with an honest empty state when a real agent has no activity", () => {
    render(
      <ActivityFeed activities={[activity({ id: "a1", createdAt: todayJakartaIso(9, 15) })]} />,
    );

    expect(screen.getByTestId("cc-activity-feed")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("cc-activity-filter"), { target: { value: "KAI" } });
    expect(screen.queryByTestId("cc-activity-feed")).not.toBeInTheDocument();
    expect(screen.getByText("Tidak ada aktivitas untuk agent ini")).toBeInTheDocument();
  });
});
