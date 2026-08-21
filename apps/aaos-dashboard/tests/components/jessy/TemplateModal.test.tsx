import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateModal } from "@/components/jessy/TemplateModal";

describe("TemplateModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Create mode requires a name and content before submitting", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<TemplateModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "✓ Simpan Template" }));
    expect(await screen.findByText("Nama template wajib diisi.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a new template with WARM+COLD targets and calls onSaved", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "t-1" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();
    render(<TemplateModal onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Nama Template *"), "Promo DP Ringan");
    await userEvent.type(screen.getByLabelText(/Isi Pesan/), "Halo {{nama}! Promo di {{cabang}.");
    await userEvent.click(screen.getByLabelText("COLD"));
    await userEvent.click(screen.getByRole("button", { name: "✓ Simpan Template" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/recycling/templates");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as { targetStatuses: string[]; name: string };
    expect(body.name).toBe("Promo DP Ringan");
    expect(body.targetStatuses).toEqual(["WARM", "COLD"]);
  });

  it("Edit mode PUTs to /api/recycling/templates/:id", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "t-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();
    render(
      <TemplateModal
        editing={{
          id: "t-1",
          name: "Promo DP Ringan",
          content: "Halo {nama}!",
          targetStatuses: ["WARM"],
          cooldownDays: 3,
          status: "ACTIVE",
          replyRate: 20,
          hotRate: 5,
          sentCount: 10,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "✓ Simpan Template" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/recycling/templates/t-1");
    expect(init.method).toBe("PUT");
  });

  it("shows a rendered preview (Pak Hendra / Cinere) once content is entered — never a fabricated live preview", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<TemplateModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Isi Pesan/), "Halo {{nama} dari {{cabang}!");
    expect(screen.getByTestId("template-preview")).toHaveTextContent(
      "Halo Pak Hendra dari Cinere!",
    );
  });

  it("closes on the ✕ button without saving", async () => {
    const onClose = vi.fn();
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<TemplateModal onClose={onClose} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Tutup"));
    expect(onClose).toHaveBeenCalled();
  });
});
