import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BranchDetailClient } from "@/components/branches/BranchDetailClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const BRANCH = {
  id: "BINTARO",
  name: "Mobix Bintaro",
  displayName: "Cabang Bintaro",
  wabaPhoneNumber: "+628110000001",
  assignmentMode: "SMART_ASSIGN",
  maxLeadsPerSalesPerDay: 10,
  active: true,
  team: [
    {
      id: "sales-1",
      name: "Budi",
      waNumber: "+628120000001",
      status: "ON",
      maxLeadsPerDay: 10,
      todayLeadCount: 2,
      isAvailable: true,
    },
  ],
  availableCount: 1,
  queueSize: 0,
  todayAssignedCount: 2,
};

describe("BranchDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the branch's WhatsApp number and sales team", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ branches: [BRANCH] }),
    ) as unknown as typeof fetch;
    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText(/\+628110000001/)).toBeInTheDocument());
    expect(screen.getByText("Budi")).toBeInTheDocument();
  });

  it("shows an empty state when the branch id is not found", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ branches: [BRANCH] }),
    ) as unknown as typeof fetch;
    render(<BranchDetailClient branchId="MISSING" />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("saving changes calls PUT with the new assignment mode + max leads", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (init?.method === "PUT")
        return jsonResponse({ branch: { ...BRANCH, assignmentMode: "ROUND_ROBIN" } });
      return jsonResponse({ branches: [BRANCH] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Round Robin"));
    await userEvent.click(screen.getByRole("button", { name: /Simpan Perubahan/ }));
    await waitFor(() => expect(screen.getByText("Perubahan disimpan.")).toBeInTheDocument());
  });

  it("removing a sales human calls PUT with removeSalesHumanIds", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (init?.method === "PUT") return jsonResponse({ branch: { ...BRANCH, team: [] } });
      return jsonResponse({ branches: [BRANCH] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("Budi")).not.toBeInTheDocument());
  });
});
