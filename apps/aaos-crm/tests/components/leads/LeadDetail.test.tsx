import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

interface FakeAuthUser {
  readonly id: string;
  readonly email?: string;
  readonly user_metadata: Record<string, unknown>;
}
const getUser = vi.fn(async (): Promise<{ data: { user: FakeAuthUser | null } }> => ({
  data: { user: null },
}));
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser },
    channel: () => {
      const fakeChannel = {
        on: () => fakeChannel,
        subscribe: () => ({ unsubscribe: vi.fn() }),
      };
      return fakeChannel;
    },
  }),
}));

import { LeadDetail } from "@/components/leads/LeadDetail";
import type { LeadDetailDto } from "@/types/crm.types";

function makeDetail(overrides: Partial<LeadDetailDto> = {}): LeadDetailDto {
  return {
    id: "lead-1",
    leadPhone: "+6281234567890",
    leadName: "Pak Andi",
    branchId: "CINERE",
    status: "HOT",
    temperature: "HOT",
    score: 85,
    qualification: {
      budget: true,
      unit: true,
      area: true,
      payment: false,
      timeline: false,
      name: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    ...overrides,
  };
}

describe("LeadDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all lead info fields", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(makeDetail()), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("CINERE")).toBeInTheDocument();
    expect(screen.getByText("85/100")).toBeInTheDocument();
  });

  it("WA link points at the correct wa.me number", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(makeDetail()), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("💬 WA Langsung")).toBeInTheDocument());
    expect(screen.getByText("💬 WA Langsung")).toHaveAttribute(
      "href",
      "https://wa.me/6281234567890",
    );
  });

  it("conversation history renders in correct order", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            makeDetail({
              messages: [
                {
                  id: "m1",
                  direction: "INCOMING",
                  messageType: "TEXT",
                  body: "halo",
                  createdAt: "2026-08-13T09:00:00.000Z",
                },
                {
                  id: "m2",
                  direction: "OUTGOING",
                  messageType: "TEXT",
                  body: "hi kak",
                  createdAt: "2026-08-13T09:01:00.000Z",
                },
              ],
            }),
          ),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByTestId("conversation-history")).toBeInTheDocument());
    const items = within(screen.getByTestId("conversation-history")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("halo");
    expect(items[1]).toHaveTextContent("hi kak");
  });

  it("'Hubungi Sekarang' button is visible", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(makeDetail()), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("📞 Hubungi Sekarang")).toBeInTheDocument());
  });

  it("never renders a fabricated 'Ringkasan Jessy' prose summary (coordinator note #2)", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(makeDetail()), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.queryByText(/Ringkasan Jessy/)).not.toBeInTheDocument();
  });

  it("sends a reply via POST /api/leads/:id/message and appends it to the timeline (AAOS-CHAT-ROOM-JESSY)", async () => {
    getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "ahmad@dssmotor.id",
          user_metadata: { salesHumanId: "sales-ahmad" },
        },
      },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/message")) {
        return new Response(
          JSON.stringify({
            id: "m-new",
            direction: "OUTGOING",
            messageType: "TEXT",
            body: "siap kak, ditunggu ya",
            createdAt: "2026-08-13T10:10:00.000Z",
            senderType: "SALES_HUMAN",
            senderName: "ahmad",
          }),
          { status: 201 },
        );
      }
      if (url.includes("/scoring-history")) {
        return new Response("[]", { status: 200 });
      }
      return new Response(JSON.stringify(makeDetail()), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());

    const input = await screen.findByLabelText("Balas ke customer");
    fireEvent.change(input, { target: { value: "siap kak, ditunggu ya" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));

    await waitFor(() => expect(screen.getByText("siap kak, ditunggu ya")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leads/lead-1/message",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    render(<LeadDetail leadId="lead-1" />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
