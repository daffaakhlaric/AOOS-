import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarWidget } from "@/components/calendar/CalendarWidget";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const NOW_ISO = "2026-08-18T02:00:00.000Z"; // 09:00 WIB

function mockFetch(events: readonly unknown[] = []): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = input.toString();
    if (url.includes("/api/calendar") && url.includes("run-now")) {
      return jsonResponse({ event: { id: "evt-1", status: "RUNNING" } });
    }
    if (url.includes("/api/calendar")) {
      return jsonResponse({ events });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("CalendarWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fetches range=this_week on mount and renders today's real events", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date(NOW_ISO));
    mockFetch([
      {
        id: "evt-1",
        eventType: "SAMANTHA_ANALYZE",
        title: "Samantha Analisa Campaign",
        scheduledAt: "2026-08-17T23:00:00.000Z", // 06:00 WIB today
        timezone: "Asia/Jakarta",
        recurrence: "DAILY",
        status: "DONE",
        result: { summary: "21 kamp · 3 PAUSE · 1 SCALE" },
        durationMs: 154000,
        createdBy: "system",
        createdAt: "2026-08-17T00:00:00.000Z",
      },
    ]);

    render(<CalendarWidget />);
    await waitFor(() => expect(screen.getByText(/Samantha Analisa Campaign/)).toBeInTheDocument());
    expect(screen.getByText(/21 kamp/)).toBeInTheDocument();
  });

  it("shows a real error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Gagal memuat" } }, 500),
    ) as unknown as typeof fetch;
    render(<CalendarWidget />);
    await waitFor(() => expect(screen.getByTestId("calendar-error")).toBeInTheDocument());
  });

  it("opens the AddEventModal on '+ Tambah' and closes it on save", async () => {
    const user = userEvent.setup();
    mockFetch([]);
    render(<CalendarWidget />);
    await waitFor(() => expect(screen.getByTestId("calendar-widget")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "+ Tambah" }));
    expect(screen.getByRole("dialog", { name: "Tambah Jadwal" })).toBeInTheDocument();
  });

  it("clicking Jalankan calls run-now then refetches", async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date(NOW_ISO));
    const fetchMock = mockFetch([
      {
        id: "evt-1",
        eventType: "SCRAPER_RUN",
        title: "Scrape Foto Mobix",
        scheduledAt: "2026-08-17T23:00:00.000Z",
        timezone: "Asia/Jakarta",
        recurrence: "ONCE",
        status: "PENDING",
        createdBy: "system",
        createdAt: "2026-08-17T00:00:00.000Z",
      },
    ]);

    render(<CalendarWidget />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Jalankan/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Jalankan/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/calendar/evt-1/run-now",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
