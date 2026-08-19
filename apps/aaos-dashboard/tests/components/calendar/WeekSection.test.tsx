import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeekSection } from "@/components/calendar/WeekSection";
import type { CalendarEventDto } from "@/types/dashboard.types";

function event(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return {
    id: "evt-1",
    eventType: "KAI_REFRESH_CHECK",
    title: "Kai Refresh Check",
    scheduledAt: "2026-08-17T01:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "WEEKLY",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("WeekSection / WeekRow", () => {
  it("renders the 'MINGGU INI' label and one compact row per event", () => {
    render(<WeekSection events={[event({ id: "a" }), event({ id: "b" })]} />);
    expect(screen.getByText("MINGGU INI")).toBeInTheDocument();
    expect(screen.getAllByText(/Kai Refresh Check/)).toHaveLength(2);
  });

  it("shows the compact weekday + time for each row", () => {
    render(<WeekSection events={[event()]} />);
    // 2026-08-17T01:00Z -> 2026-08-17 08:00 WIB, a Monday.
    expect(screen.getByText("08:00")).toBeInTheDocument();
  });
});
