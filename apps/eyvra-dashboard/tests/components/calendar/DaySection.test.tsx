import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DaySection } from "@/components/calendar/DaySection";
import type { CalendarEventDto } from "@/types/dashboard.types";

function event(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return {
    id: "evt-1",
    eventType: "SCRAPER_RUN",
    title: "Scrape Foto Mobix",
    scheduledAt: "2026-08-18T23:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "ONCE",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("DaySection", () => {
  it("renders the label and one EventRow per event", () => {
    render(
      <DaySection
        label="HARI INI — Selasa, 18 Agu 2026"
        events={[event({ id: "a" }), event({ id: "b", title: "Kai Refresh Check" })]}
        onRunNow={vi.fn()}
      />,
    );
    expect(screen.getByText("HARI INI — Selasa, 18 Agu 2026")).toBeInTheDocument();
    expect(screen.getAllByTestId("calendar-event-row")).toHaveLength(2);
  });

  it("shows the emptyLabel when there are no events and one is supplied", () => {
    render(
      <DaySection
        label="HARI INI"
        events={[]}
        onRunNow={vi.fn()}
        emptyLabel="Tidak ada jadwal hari ini."
      />,
    );
    expect(screen.getByText("Tidak ada jadwal hari ini.")).toBeInTheDocument();
  });

  it("renders nothing extra when there are no events and no emptyLabel", () => {
    render(<DaySection label="BESOK" events={[]} onRunNow={vi.fn()} />);
    expect(screen.queryByTestId("calendar-event-row")).not.toBeInTheDocument();
  });
});
