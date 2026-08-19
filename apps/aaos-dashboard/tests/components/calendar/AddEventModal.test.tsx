import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddEventModal } from "@/components/calendar/AddEventModal";

describe("AddEventModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only lists the 5 supported event types (grouped Tamara/Kai/Operasional)", () => {
    render(<AddEventModal onClose={vi.fn()} onSaved={vi.fn()} />);
    const select = screen.getByLabelText("Tipe Aktivitas") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues.sort()).toEqual(
      [
        "TAMARA_ANALYZE",
        "TAMARA_PULL_DATA",
        "DAILY_DIGEST",
        "KAI_REFRESH_CHECK",
        "SCRAPER_RUN",
      ].sort(),
    );
    // None of the 9 excluded types ever appears.
    expect(optionValues).not.toContain("CAMPAIGN_CREATE");
    expect(optionValues).not.toContain("VERDICT_EXECUTE");
    expect(optionValues).not.toContain("PERFORMANCE_REVIEW");
  });

  it("clicking a time preset selects it", async () => {
    const user = userEvent.setup();
    render(<AddEventModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "08:00" }));
    expect(screen.getByLabelText("Jam")).toHaveValue("08:00");
  });

  it("shows the day picker only when recurrence is WEEKLY", async () => {
    const user = userEvent.setup();
    render(<AddEventModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByText("Hari")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mingguan" }));
    expect(screen.getByText("Hari")).toBeInTheDocument();
  });

  it("requires at least one day before saving a WEEKLY recurrence", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<AddEventModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Mingguan" }));
    await user.click(screen.getByRole("button", { name: "✓ Simpan Jadwal" }));
    expect(screen.getByText("Pilih minimal satu hari untuk jadwal mingguan.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("POSTs the real form values to /api/calendar and calls onSaved", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "evt-1" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();

    render(<AddEventModal onClose={vi.fn()} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "✓ Simpan Jadwal" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      eventType: string;
      recurrence: string;
      scheduledAt: string;
    };
    expect(body.eventType).toBe("TAMARA_ANALYZE");
    expect(body.recurrence).toBe("ONCE");
    expect(body.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T06:00:00\+07:00$/);
  });

  it("shows a real error message and does not call onSaved when the save fails", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Gagal disimpan" } }), { status: 500 }),
    ) as unknown as typeof fetch;
    const onSaved = vi.fn();

    render(<AddEventModal onClose={vi.fn()} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "✓ Simpan Jadwal" }));

    await waitFor(() => expect(screen.getByText("Gagal disimpan")).toBeInTheDocument());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("Batal calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddEventModal onClose={onClose} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(onClose).toHaveBeenCalled();
  });
});
