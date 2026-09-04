import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadDetailDrawer } from "@/components/leads/LeadDetailDrawer";

const DETAIL = {
  id: "lead-1",
  leadPhone: "62811",
  leadName: "Pak Andi",
  branchId: "cinere",
  status: "NEW",
  temperature: "HOT",
  score: 92,
  qualification: {
    budget: true,
    unit: true,
    area: false,
    payment: false,
    timeline: true,
    name: true,
  },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  becameHotAt: "2026-08-05T00:00:00.000Z",
  lastMessageAt: "2026-09-01T00:00:00.000Z",
  messages: [
    {
      id: "m1",
      direction: "INCOMING",
      messageType: "text",
      body: "Halo",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "m2",
      direction: "OUTGOING",
      messageType: "text",
      body: "Selamat siang!",
      senderType: "CLARA",
      createdAt: "2026-08-01T00:01:00.000Z",
    },
  ],
};

function mockFetchOnce(body: unknown): void {
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe("LeadDetailDrawer (EYVRA MENU RESTRUCTURE Sprint 2, Leads hub lead detail drawer)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the real GET /api/leads/:id and renders real score breakdown (6 qualification dimensions) + last messages", async () => {
    mockFetchOnce(DETAIL);
    render(<LeadDetailDrawer leadId="lead-1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getAllByText("Timeline").length).toBeGreaterThan(0);
    expect(screen.getByText("Halo")).toBeInTheDocument();
    expect(screen.getByText("Selamat siang!")).toBeInTheDocument();
  });

  it("'Buka percakapan penuh' links to the real Inbox tab with this lead pre-selected", async () => {
    mockFetchOnce(DETAIL);
    render(<LeadDetailDrawer leadId="lead-1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Buka percakapan penuh")).toHaveAttribute(
      "href",
      "/leads?tab=inbox&lead=lead-1",
    );
  });

  it("clicking the close button calls onClose", async () => {
    mockFetchOnce(DETAIL);
    const onClose = vi.fn();
    render(<LeadDetailDrawer leadId="lead-1" onClose={onClose} />);
    await userEvent.click(screen.getByLabelText("Tutup"));
    expect(onClose).toHaveBeenCalled();
  });
});
