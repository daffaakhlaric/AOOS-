import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventRow } from "@/components/calendar/EventRow";
import type { CalendarEventDto } from "@/types/dashboard.types";

function event(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return {
    id: "evt-1",
    eventType: "TAMARA_ANALYZE",
    title: "Tamara Analisa Campaign",
    scheduledAt: "2026-08-18T23:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "ONCE",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("EventRow", () => {
  it("shows the real event-type icon + title + time", () => {
    render(<EventRow event={event()} onRunNow={vi.fn()} />);
    expect(screen.getByText(/Tamara Analisa Campaign/)).toBeInTheDocument();
    expect(screen.getByText("06:00")).toBeInTheDocument();
  });

  it("DONE shows the real result summary + duration", () => {
    render(
      <EventRow
        event={event({
          status: "DONE",
          result: { summary: "21 kamp · 3 PAUSE · 1 SCALE" },
          durationMs: 154_000,
        })}
        onRunNow={vi.fn()}
      />,
    );
    expect(screen.getByText(/21 kamp · 3 PAUSE · 1 SCALE/)).toBeInTheDocument();
    expect(screen.getByText(/154s/)).toBeInTheDocument();
  });

  it("PENDING shows the description and a Jalankan button", () => {
    const onRunNow = vi.fn();
    render(
      <EventRow
        event={event({ status: "PENDING", description: "Cek iklan jenuh → brief ke Kai" })}
        onRunNow={onRunNow}
      />,
    );
    expect(screen.getByText("Cek iklan jenuh → brief ke Kai")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Jalankan/ });
    button.click();
    expect(onRunNow).toHaveBeenCalledWith("evt-1");
  });

  it("FAILED shows the real error message and an Ulang button", () => {
    const onRunNow = vi.fn();
    render(
      <EventRow
        event={event({ status: "FAILED", errorMessage: "Meta API timeout" })}
        onRunNow={onRunNow}
      />,
    );
    expect(screen.getByText(/Gagal: Meta API timeout/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Ulang/ });
    button.click();
    expect(onRunNow).toHaveBeenCalledWith("evt-1");
  });

  it("disables its own action button while pendingActionId matches this row", () => {
    render(
      <EventRow event={event({ status: "PENDING" })} onRunNow={vi.fn()} pendingActionId="evt-1" />,
    );
    expect(screen.getByRole("button", { name: /Jalankan/ })).toBeDisabled();
  });
});
