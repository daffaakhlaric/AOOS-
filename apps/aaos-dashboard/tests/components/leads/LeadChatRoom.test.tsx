import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { LeadChatRoom } from "@/components/leads/LeadChatRoom";
import type { LeadDetailDto, ScoringEventDto } from "@/types/dashboard.types";

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
    createdAt: "2026-08-14T09:41:00.000Z",
    updatedAt: "2026-08-14T09:41:00.000Z",
    messages: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(detail: LeadDetailDto, scoringEvents: readonly ScoringEventDto[] = []): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/scoring-history")) {
      return jsonResponse(scoringEvents);
    }
    return jsonResponse(detail);
  }) as unknown as typeof fetch;
}

describe("LeadChatRoom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders lead name, branch, and score", async () => {
    mockFetch(makeDetail());
    render(<LeadChatRoom leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getAllByText(/CINERE/).length).toBeGreaterThan(0);
    expect(screen.getByText("85/100")).toBeInTheDocument();
  });

  it("shows an empty timeline message when there is no conversation yet", async () => {
    mockFetch(makeDetail());
    render(<LeadChatRoom leadId="lead-1" />);
    await waitFor(() => expect(screen.getByTestId("chat-empty")).toBeInTheDocument());
  });

  it("renders messages with sender-type-aware labels (AAOS-CHAT-ROOM-JESSY)", async () => {
    mockFetch(
      makeDetail({
        messages: [
          {
            id: "m1",
            direction: "INCOMING",
            messageType: "TEXT",
            body: "halo kak",
            createdAt: "2026-08-14T09:41:00.000Z",
          },
          {
            id: "m2",
            direction: "OUTGOING",
            messageType: "TEXT",
            body: "Halo Pak Andi, saya Ahmad",
            createdAt: "2026-08-14T10:05:00.000Z",
            senderType: "SALES_HUMAN",
            senderName: "Ahmad Fauzi",
          },
        ],
      }),
    );
    render(<LeadChatRoom leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("halo kak")).toBeInTheDocument());
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Ahmad Fauzi")).toBeInTheDocument();
  });

  it("merges real scoring_events into the timeline as system-event dividers", async () => {
    mockFetch(makeDetail(), [
      {
        id: "s1",
        leadId: "lead-1",
        scoreBefore: 0,
        scoreAfter: 25,
        delta: 25,
        reason: "BUDGET",
        createdAt: "2026-08-14T09:42:00.000Z",
      },
    ]);
    render(<LeadChatRoom leadId="lead-1" />);
    await waitFor(() => expect(screen.getByTestId("scoring-timeline")).toBeInTheDocument());
    expect(screen.getAllByText(/BUDGET/).length).toBeGreaterThan(0);
  });

  it("sends an intervention via POST /api/leads/:id/intervene, persisted as MANAGER_INTERVENTION never JESSY", async () => {
    const detail = makeDetail();
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/scoring-history")) {
        return jsonResponse([]);
      }
      if (url.includes("/intervene")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          id: "m-new",
          direction: "OUTGOING",
          messageType: "TEXT",
          body: "halo dari Jessy",
          createdAt: "2026-08-14T10:10:00.000Z",
          senderType: "MANAGER_INTERVENTION",
          senderName: "Manager",
        });
      }
      return jsonResponse(detail);
    }) as unknown as typeof fetch;

    render(<LeadChatRoom leadId="lead-1" />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Ketik pesan...");
    fireEvent.change(input, { target: { value: "halo dari Jessy" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));

    await waitFor(() => expect(screen.getByText("halo dari Jessy")).toBeInTheDocument());
    expect(screen.getByText(/🤖 Jessy \(intervensi/)).toBeInTheDocument();
  });

  it("shows an error card when the lead fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<LeadChatRoom leadId="lead-1" />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
