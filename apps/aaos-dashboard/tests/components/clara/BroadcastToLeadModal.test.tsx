import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BroadcastToLeadModal } from "@/components/clara/BroadcastToLeadModal";
import type { RecyclingPoolLeadDto, TemplateDto } from "@/types/dashboard.types";

const LEAD: RecyclingPoolLeadDto = {
  id: "lead-1",
  leadName: "Pak Hendra",
  leadPhone: "+6281234560006",
  branchId: "CINERE",
  status: "WARM",
  score: 45,
  temperature: "WARM",
  broadcastCount: 0,
  readyToSend: true,
};

const TEMPLATE: TemplateDto = {
  id: "template-1",
  name: "Promo DP Ringan",
  content: "Halo {nama}! DP mulai dari cabang {cabang}.",
  targetStatuses: ["WARM", "COLD"],
  cooldownDays: 3,
  status: "ACTIVE",
  replyRate: 28,
  hotRate: 8,
  sentCount: 42,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("BroadcastToLeadModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest 'no template' message when nothing matches the lead's status", () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<BroadcastToLeadModal lead={LEAD} templates={[]} onClose={vi.fn()} onSent={vi.fn()} />);
    expect(
      screen.getByText("Tidak ada template aktif yang cocok untuk status WARM lead ini."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kirim Sekarang/ })).toBeDisabled();
  });

  it("renders the real preview with {nama}/{cabang} substituted, nothing else fabricated", () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(
      <BroadcastToLeadModal
        lead={LEAD}
        templates={[TEMPLATE]}
        onClose={vi.fn()}
        onSent={vi.fn()}
      />,
    );
    expect(screen.getByTestId("broadcast-preview")).toHaveTextContent(
      "Halo Pak Hendra! DP mulai dari cabang CINERE.",
    );
  });

  it("POSTs the selected templateId to /api/recycling/broadcast/:leadId and calls onSent", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            leadId: "lead-1",
            templateId: "template-1",
            broadcastLogId: "log-1",
            sentAt: "2026-01-15T08:00:00.000Z",
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSent = vi.fn();
    render(
      <BroadcastToLeadModal lead={LEAD} templates={[TEMPLATE]} onClose={vi.fn()} onSent={onSent} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Kirim Sekarang/ }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/recycling/broadcast/lead-1");
    expect(JSON.parse(init.body as string)).toEqual({ templateId: "template-1" });
  });

  it("shows the real error message on a failed send", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Lead sudah archived" } }), {
          status: 422,
        }),
    ) as unknown as typeof fetch;
    render(
      <BroadcastToLeadModal
        lead={LEAD}
        templates={[TEMPLATE]}
        onClose={vi.fn()}
        onSent={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Kirim Sekarang/ }));
    expect(await screen.findByText("Lead sudah archived")).toBeInTheDocument();
  });
});
