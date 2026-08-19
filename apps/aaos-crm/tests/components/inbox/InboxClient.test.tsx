import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    channel: () => {
      const fakeChannel = {
        on: () => fakeChannel,
        subscribe: () => ({ unsubscribe: vi.fn() }),
      };
      return fakeChannel;
    },
  }),
}));

import { InboxClient } from "@/components/inbox/InboxClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const ACCOUNT = {
  id: "sh-1",
  name: "Ahmad Fauzi",
  email: "ahmad@mobix.id",
  phone: "1",
  branchId: "BINTARO",
  status: "ON",
  maxLeadsPerDay: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: undefined,
};

const MINE_LEAD = {
  id: "lead-mine",
  leadPhone: "+6281111111111",
  leadName: "Pak Mine",
  branchId: "BINTARO",
  status: "ASSIGNED",
  temperature: "HOT",
  score: 70,
  qualification: {
    budget: true,
    unit: true,
    area: true,
    payment: true,
    timeline: true,
    name: true,
  },
  assignedSalesId: "sh-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const OTHER_LEAD = {
  id: "lead-other",
  leadPhone: "+6282222222222",
  leadName: "Bu Other",
  branchId: "BINTARO",
  status: "ASSIGNED",
  temperature: "WARM",
  score: 40,
  qualification: {
    budget: true,
    unit: true,
    area: true,
    payment: true,
    timeline: true,
    name: true,
  },
  assignedSalesId: "sh-2",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildFetchMock(
  overrides: {
    messagesByLead?: Record<string, unknown[]>;
    onSendMessage?: () => Response;
    onClaim?: () => Response;
  } = {},
): typeof fetch {
  return vi.fn(async (input: string | URL) => {
    const url = input.toString();
    if (url.includes("/api/sales-humans/")) {
      return jsonResponse(ACCOUNT);
    }
    if (url.match(/\/api\/leads\/[^/]+\/messages/)) {
      const leadId = url.match(/\/api\/leads\/([^/]+)\/messages/)?.[1] ?? "";
      const messages = overrides.messagesByLead?.[leadId] ?? [];
      return jsonResponse({ messages, page: 1, limit: 1, total: messages.length });
    }
    if (url.match(/\/api\/leads\/[^/]+\/claim/)) {
      return overrides.onClaim?.() ?? jsonResponse({ ...MINE_LEAD, assignedSalesId: "sh-1" });
    }
    if (url.match(/\/api\/leads\/[^/]+\/message/) && !url.includes("messages")) {
      return (
        overrides.onSendMessage?.() ??
        jsonResponse({
          id: "msg-new",
          direction: "OUTGOING",
          messageType: "TEXT",
          body: "hi",
          createdAt: "x",
        })
      );
    }
    if (url.match(/\/api\/leads\/[^/]+$/)) {
      return jsonResponse({ ...MINE_LEAD, messages: [] });
    }
    if (url.includes("/api/leads?")) {
      return jsonResponse({ leads: [MINE_LEAD, OTHER_LEAD] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("InboxClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows only the signed-in sales human's leads under Saya", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "ahmad@mobix.id" },
      loading: false,
    });
    global.fetch = buildFetchMock();
    render(<InboxClient />);

    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());
    expect(screen.queryByText("Bu Other")).not.toBeInTheDocument();
  });

  it("Semua tab shows every lead in the branch regardless of assignment", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "ahmad@mobix.id" },
      loading: false,
    });
    global.fetch = buildFetchMock();
    render(<InboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Semua" }));
    await waitFor(() => expect(screen.getByText("Bu Other")).toBeInTheDocument());
  });

  it("Belum dibaca tab shows only leads whose latest message is an unread incoming message", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "ahmad@mobix.id" },
      loading: false,
    });
    global.fetch = buildFetchMock({
      messagesByLead: {
        "lead-mine": [
          { id: "m1", direction: "INCOMING", messageType: "TEXT", body: "hi", createdAt: "x" },
        ],
        "lead-other": [
          {
            id: "m2",
            direction: "INCOMING",
            messageType: "TEXT",
            body: "hi",
            createdAt: "x",
            readAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    });
    render(<InboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Semua" }));
    await waitFor(() => expect(screen.getByText("Bu Other")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: /Belum dibaca/ }));
    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());
    expect(screen.queryByText("Bu Other")).not.toBeInTheDocument();
  });

  it("selecting a conversation loads the detail and sends a reply as the sales human (never Jessy)", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "ahmad@mobix.id" },
      loading: false,
    });
    const fetchMock = buildFetchMock();
    global.fetch = fetchMock;
    render(<InboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("conversation-row"));
    await waitFor(() => expect(screen.getByLabelText("Ketik pesan")).toBeInTheDocument());
    expect(screen.getByText(/Membalas sebagai:/)).toHaveTextContent("Ahmad Fauzi");

    await userEvent.type(screen.getByLabelText("Ketik pesan"), "Halo pak");
    await userEvent.click(screen.getByRole("button", { name: "Kirim" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/leads/lead-mine/message",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("shows a Klaim Lead Ini button and the bot-active banner for an unassigned lead", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "ahmad@mobix.id" },
      loading: false,
    });
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/sales-humans/")) {
        return jsonResponse(ACCOUNT);
      }
      if (url.match(/\/api\/leads\/[^/]+\/messages/)) {
        return jsonResponse({ messages: [], page: 1, limit: 1, total: 0 });
      }
      if (url.match(/\/api\/leads\/[^/]+$/)) {
        return jsonResponse({ ...MINE_LEAD, assignedSalesId: undefined, messages: [] });
      }
      if (url.includes("/api/leads?")) {
        return jsonResponse({ leads: [{ ...MINE_LEAD, assignedSalesId: undefined }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    render(<InboxClient />);
    await userEvent.click(screen.getByRole("tab", { name: "Semua" }));
    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("conversation-row"));

    await waitFor(() => expect(screen.getByTestId("bot-active-banner")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Klaim Lead Ini" })).toBeInTheDocument();
  });

  it("links Input Closing to the real /closing/new flow", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "ahmad@mobix.id" },
      loading: false,
    });
    global.fetch = buildFetchMock();
    render(<InboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Mine")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("conversation-row"));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Input Closing/ })).toHaveAttribute(
        "href",
        "/closing/new?leadId=lead-mine",
      ),
    );
  });
});
