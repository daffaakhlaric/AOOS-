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
  team: [],
  availableCount: 1,
  queueSize: 0,
  todayAssignedCount: 2,
};

const SALES_HUMAN = {
  id: "sales-1",
  name: "Budi",
  email: "budi@mobix.id",
  phone: "+628120000001",
  branchId: "BINTARO",
  status: "ON",
  maxLeadsPerDay: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: undefined,
};

function routeFetchMock(overrides?: {
  onPutBranch?: () => Response;
  onPutSalesHuman?: () => Response;
}): typeof fetch {
  let currentSalesHuman = SALES_HUMAN;
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/api/branches") && init?.method === "PUT") {
      return overrides?.onPutBranch?.() ?? jsonResponse({ branch: BRANCH });
    }
    if (url.includes("/api/branches")) {
      return jsonResponse({ branches: [BRANCH] });
    }
    if (url.includes("/api/sales-humans") && init?.method === "PUT") {
      currentSalesHuman = { ...currentSalesHuman, status: "OFF" };
      return overrides?.onPutSalesHuman?.() ?? jsonResponse({ salesHuman: currentSalesHuman });
    }
    if (url.includes("/api/sales-humans")) {
      return jsonResponse({ salesHumans: [currentSalesHuman] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("BranchDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the branch's WhatsApp number and the real sales team", async () => {
    global.fetch = routeFetchMock();
    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText(/\+628110000001/)).toBeInTheDocument());
    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.getByText("budi@mobix.id")).toBeInTheDocument();
  });

  it("shows an empty state when the branch id is not found", async () => {
    global.fetch = routeFetchMock();
    render(<BranchDetailClient branchId="MISSING" />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("saving changes calls PUT with the new assignment mode + max leads", async () => {
    global.fetch = routeFetchMock({
      onPutBranch: () => jsonResponse({ branch: { ...BRANCH, assignmentMode: "ROUND_ROBIN" } }),
    });

    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Round Robin"));
    await userEvent.click(screen.getByRole("button", { name: /Simpan Perubahan/ }));
    await waitFor(() => expect(screen.getByText("Perubahan disimpan.")).toBeInTheDocument());
  });

  it("clicking Nonaktif calls PUT /api/sales-humans/:id with status OFF and refreshes the list", async () => {
    global.fetch = routeFetchMock();
    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Nonaktif" }));
    await waitFor(() => expect(screen.getByText("OFF")).toBeInTheDocument());
  });

  it("clicking + Tambah Sales Human opens the Add Sales modal", async () => {
    global.fetch = routeFetchMock();
    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "+ Tambah Sales Human" }));
    expect(screen.getByRole("dialog", { name: "Tambah Sales Human" })).toBeInTheDocument();
  });

  it("clicking Edit opens the edit modal pre-filled with the sales human's data", async () => {
    global.fetch = routeFetchMock();
    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Budi")).toBeInTheDocument();
  });

  it("clicking Reset PW opens the reset password modal", async () => {
    global.fetch = routeFetchMock();
    render(<BranchDetailClient branchId="BINTARO" />);
    await waitFor(() => expect(screen.getByText("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Reset PW" }));
    expect(screen.getByText(/Reset password untuk Budi/)).toBeInTheDocument();
  });
});
