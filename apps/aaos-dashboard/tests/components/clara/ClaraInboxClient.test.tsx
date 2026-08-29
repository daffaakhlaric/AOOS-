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

import { ClaraInboxClient } from "@/components/clara/ClaraInboxClient";
import type { BranchDto, LeadDetailDto, LeadDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const BOT_LEAD: LeadDto = {
  id: "lead-bot",
  leadPhone: "+6281111111111",
  leadName: "Pak Bot",
  branchId: "CINERE",
  status: "HOT",
  temperature: "HOT",
  score: 70,
  createdAt: "2026-08-14T09:41:00.000Z",
  lastMessageAt: "2026-08-14T10:00:00.000Z",
};

const HUMAN_LEAD: LeadDto = {
  id: "lead-human",
  leadPhone: "+6282222222222",
  leadName: "Bu Human",
  branchId: "CINERE",
  status: "WARM",
  temperature: "WARM",
  score: 55,
  createdAt: "2026-08-14T09:41:00.000Z",
  lastMessageAt: "2026-08-14T09:50:00.000Z",
  assignedSalesId: "sales-1",
};

const BRANCH: BranchDto = {
  id: "CINERE",
  name: "CINERE",
  displayName: "Cinere",
  wabaPhoneNumber: "+6280000000000",
  assignmentMode: "MANUAL",
  maxLeadsPerSalesPerDay: 10,
  active: true,
  team: [
    {
      id: "sales-1",
      name: "Ahmad Fauzi",
      waNumber: "+6283333333333",
      status: "ON",
      maxLeadsPerDay: 10,
      todayLeadCount: 1,
      isAvailable: true,
    },
  ],
  availableCount: 1,
  queueSize: 0,
  todayAssignedCount: 1,
};

const BRANCH_2: BranchDto = {
  id: "BINTARO",
  name: "BINTARO",
  displayName: "Bintaro",
  wabaPhoneNumber: "+6280000000001",
  assignmentMode: "MANUAL",
  maxLeadsPerSalesPerDay: 10,
  active: true,
  team: [
    {
      id: "sales-2",
      name: "Budi Santoso",
      waNumber: "+6283333333334",
      status: "ON",
      maxLeadsPerDay: 10,
      todayLeadCount: 1,
      isAvailable: true,
    },
  ],
  availableCount: 1,
  queueSize: 0,
  todayAssignedCount: 1,
};

const HUMAN_LEAD_2: LeadDto = {
  id: "lead-human-2",
  leadPhone: "+6284444444444",
  leadName: "Pak Bintaro",
  branchId: "BINTARO",
  status: "WARM",
  temperature: "WARM",
  score: 55,
  createdAt: "2026-08-14T09:41:00.000Z",
  lastMessageAt: "2026-08-14T09:50:00.000Z",
  assignedSalesId: "sales-2",
};

function makeDetail(overrides: Partial<LeadDetailDto> = {}): LeadDetailDto {
  return {
    id: "lead-bot",
    leadPhone: "+6281111111111",
    leadName: "Pak Bot",
    branchId: "CINERE",
    status: "HOT",
    temperature: "HOT",
    score: 70,
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

function mockFetch(
  leads: readonly LeadDto[],
  detail: LeadDetailDto,
  extra?: (url: string, init?: RequestInit) => Response | undefined,
  branches: readonly BranchDto[] = [BRANCH],
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const extraResult = extra?.(url, init);
    if (extraResult !== undefined) {
      return extraResult;
    }
    if (url.includes("/api/branches")) {
      return jsonResponse({ branches });
    }
    if (url === "/api/leads") {
      return jsonResponse({ leads });
    }
    if (url.includes("/api/leads/")) {
      return jsonResponse(detail);
    }
    return jsonResponse({});
  }) as unknown as typeof fetch;
}

describe("ClaraInboxClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the Bot tab and shows leads with no active assignment", async () => {
    mockFetch([BOT_LEAD, HUMAN_LEAD], makeDetail());
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());
    expect(screen.queryByText("Bu Human")).not.toBeInTheDocument();
  });

  it("switches to the Human tab and shows leads with an active assignment", async () => {
    mockFetch([BOT_LEAD, HUMAN_LEAD], makeDetail());
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Human" }));
    await waitFor(() => expect(screen.getByText("Bu Human")).toBeInTheDocument());
    expect(screen.queryByText("Pak Bot")).not.toBeInTheDocument();
  });

  it("filters the list by the search input", async () => {
    mockFetch([BOT_LEAD], makeDetail());
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Cari percakapan"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.queryByText("Pak Bot")).not.toBeInTheDocument());
  });

  it("selecting a conversation loads the chat and shows the bot-active banner for an unassigned lead", async () => {
    mockFetch([BOT_LEAD], makeDetail());
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("conversation-row"));
    await waitFor(() => expect(screen.getByTestId("bot-active-banner")).toBeInTheDocument());
    expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
  });

  it("sends a message as Clara via POST /api/leads/:id/intervene", async () => {
    mockFetch([BOT_LEAD], makeDetail(), (url, init) => {
      if (url.includes("/intervene")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          id: "m-new",
          direction: "OUTGOING",
          messageType: "TEXT",
          body: "halo dari Clara",
          createdAt: "2026-08-14T10:10:00.000Z",
          senderType: "MANAGER_INTERVENTION",
          senderName: "Manager",
        });
      }
      return undefined;
    });
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("conversation-row"));
    await waitFor(() => expect(screen.getByTestId("chat-empty")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Ketik pesan"), {
      target: { value: "halo dari Clara" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));

    await waitFor(() => expect(screen.getByText("halo dari Clara")).toBeInTheDocument());
  });

  it("shows an empty state when there are no conversations in the active tab", async () => {
    mockFetch([], makeDetail());
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Tidak ada percakapan")).toBeInTheDocument());
  });

  it("filters the list by branch", async () => {
    mockFetch([BOT_LEAD, HUMAN_LEAD_2], makeDetail(), undefined, [BRANCH, BRANCH_2]);
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Filter cabang"), { target: { value: "BINTARO" } });
    await waitFor(() => expect(screen.queryByText("Pak Bot")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Human" }));
    await waitFor(() => expect(screen.getByText("Pak Bintaro")).toBeInTheDocument());
  });

  it("on the Human tab, filters by which sales is handling and shows an assigned-sales tag per row", async () => {
    mockFetch([HUMAN_LEAD, HUMAN_LEAD_2], makeDetail(), undefined, [BRANCH, BRANCH_2]);
    render(<ClaraInboxClient />);
    fireEvent.click(screen.getByRole("button", { name: "Human" }));
    await waitFor(() => expect(screen.getByText("Bu Human")).toBeInTheDocument());
    expect(screen.getByText("Pak Bintaro")).toBeInTheDocument();
    expect(screen.getByText("👤 Ahmad Fauzi")).toBeInTheDocument();
    expect(screen.getByText("👤 Budi Santoso")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter sales"), { target: { value: "sales-2" } });
    await waitFor(() => expect(screen.queryByText("Bu Human")).not.toBeInTheDocument());
    expect(screen.getByText("Pak Bintaro")).toBeInTheDocument();
  });

  it("hides the sales filter on the Bot tab (leads there have no assigned sales)", async () => {
    mockFetch([BOT_LEAD], makeDetail());
    render(<ClaraInboxClient />);
    await waitFor(() => expect(screen.getByText("Pak Bot")).toBeInTheDocument());
    expect(screen.queryByLabelText("Filter sales")).not.toBeInTheDocument();
  });
});
