import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/leads/LeadDetailDrawer", () => ({
  LeadDetailDrawer: ({ leadId }: { readonly leadId: string }) => (
    <div data-testid="real-lead-detail-drawer">{leadId}</div>
  ),
}));

import { LeadPipelineBoard } from "@/components/leads/LeadPipelineBoard";

const LEADS = [
  {
    id: "hot-1",
    leadPhone: "62811",
    leadName: "Pak Andi",
    branchId: "cinere",
    status: "NEW",
    temperature: "HOT",
    score: 92,
    createdAt: "2026-08-01T00:00:00.000Z",
    leadSource: "Meta Ads",
    lastMessageAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "warm-1",
    leadPhone: "62822",
    leadName: "Bu Sari",
    branchId: "bintaro",
    status: "NEW",
    temperature: "WARM",
    score: 55,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

function mockFetchOnce(body: unknown): void {
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe("LeadPipelineBoard (EYVRA MENU RESTRUCTURE Sprint 2, Leads hub 'Pipeline' tab)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("groups real leads from GET /api/leads into HOT/WARM/COLD columns", async () => {
    mockFetchOnce({ leads: LEADS });
    render(<LeadPipelineBoard />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Bu Sari")).toBeInTheDocument();
    const board = screen.getByTestId("lead-pipeline-board");
    expect(board).toHaveTextContent("HOT");
    expect(board).toHaveTextContent("WARM");
    expect(board).toHaveTextContent("COLD");
  });

  it("shows an empty state when there are no leads at all", async () => {
    mockFetchOnce({ leads: [] });
    render(<LeadPipelineBoard />);
    await waitFor(() => expect(screen.getByText("Belum ada lead.")).toBeInTheDocument());
  });

  it("clicking a lead card opens the real LeadDetailDrawer for that lead", async () => {
    mockFetchOnce({ leads: LEADS });
    render(<LeadPipelineBoard />);
    await waitFor(() => expect(screen.getByTestId("lead-card-hot-1")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("lead-card-hot-1"));
    expect(screen.getByTestId("real-lead-detail-drawer")).toHaveTextContent("hot-1");
  });
});
