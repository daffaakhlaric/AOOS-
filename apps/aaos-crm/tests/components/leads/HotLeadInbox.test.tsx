import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

let capturedHandlers:
  | {
      onNewLead: (lead: unknown) => void;
      onLeadClaimed: (leadId: string) => void;
    }
  | undefined;
const unsubscribe = vi.fn(async () => "ok");
vi.mock("@/lib/realtime", () => ({
  subscribeToHotLeads: (
    _branchId: string,
    handlers: { onNewLead: (lead: unknown) => void; onLeadClaimed: (leadId: string) => void },
  ) => {
    capturedHandlers = handlers;
    return { unsubscribe };
  },
}));

import { HotLeadInbox } from "@/components/leads/HotLeadInbox";

function makeLead(overrides: Record<string, unknown> = {}) {
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
      payment: true,
      timeline: true,
      name: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("HotLeadInbox", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    capturedHandlers = undefined;
  });

  it("renders a loading spinner while the session is loading", () => {
    useSalesSession.mockReturnValue({ session: undefined, loading: true });
    render(<HotLeadInbox />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders empty state when no hot leads", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sales-rina", branchId: "CINERE" },
      loading: false,
    });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ leads: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<HotLeadInbox />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("renders a list of hot lead cards", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sales-rina", branchId: "CINERE" },
      loading: false,
    });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ leads: [makeLead()] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<HotLeadInbox />);
    await waitFor(() => expect(screen.getByTestId("hot-leads-list")).toBeInTheDocument());
    expect(screen.getAllByTestId("hot-lead-card")).toHaveLength(1);
  });

  it("shows the '🔴 Live' badge once the realtime subscription is set up", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sales-rina", branchId: "CINERE" },
      loading: false,
    });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ leads: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<HotLeadInbox />);
    await waitFor(() => expect(screen.getByTestId("realtime-badge")).toHaveTextContent("Live"));
  });

  it("shows a toast and prepends the lead when a new hot lead arrives via realtime", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sales-rina", branchId: "CINERE" },
      loading: false,
    });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ leads: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<HotLeadInbox />);
    await waitFor(() => expect(capturedHandlers).toBeDefined());
    act(() => {
      capturedHandlers?.onNewLead(makeLead({ id: "lead-new", leadName: "Bu Sari" }));
    });
    await waitFor(() => expect(screen.getByTestId("new-lead-toast")).toHaveTextContent("Bu Sari"));
    expect(screen.getAllByTestId("hot-lead-card")).toHaveLength(1);
  });

  it("removes a lead from the list when claimed via realtime", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sales-rina", branchId: "CINERE" },
      loading: false,
    });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ leads: [makeLead()] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<HotLeadInbox />);
    await waitFor(() => expect(screen.getAllByTestId("hot-lead-card")).toHaveLength(1));
    act(() => {
      capturedHandlers?.onLeadClaimed("lead-1");
    });
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows an error card when the initial fetch fails", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sales-rina", branchId: "CINERE" },
      loading: false,
    });
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    render(<HotLeadInbox />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
