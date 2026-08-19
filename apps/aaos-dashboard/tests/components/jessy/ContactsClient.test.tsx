import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactsClient } from "@/components/jessy/ContactsClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LEAD = {
  id: "lead-1",
  leadPhone: "+6281200000001",
  leadName: "Pak Andi",
  branchId: "CINERE",
  status: "NEW",
  temperature: "HOT",
  score: 90,
  createdAt: "2026-08-01T00:00:00.000Z",
  leadSource: "Inbound Message",
  lastMessageAt: "2026-08-10T00:00:00.000Z",
};

const BRANCH = {
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

function mockFetch(
  leads: readonly unknown[],
  extra?: (url: string, init?: RequestInit) => Response | undefined,
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const extraResult = extra?.(url, init);
    if (extraResult !== undefined) {
      return extraResult;
    }
    if (url.includes("/api/branches")) {
      return jsonResponse({ branches: [BRANCH] });
    }
    return jsonResponse({ leads });
  }) as unknown as typeof fetch;
}

describe("ContactsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every lead across branches with source and last seen", async () => {
    mockFetch([LEAD]);
    render(<ContactsClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Inbound Message")).toBeInTheDocument();
  });

  it("each row's name links to /jessy/inbox?lead=[id]", async () => {
    mockFetch([LEAD]);
    render(<ContactsClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Pak Andi").closest("a")).toHaveAttribute(
      "href",
      "/jessy/inbox?lead=lead-1",
    );
  });

  it("filters by the search input", async () => {
    mockFetch([LEAD]);
    render(<ContactsClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Cari kontak"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.queryByText("Pak Andi")).not.toBeInTheDocument());
  });

  it("assigns a lead via POST /api/leads/:id/claim, using the real ClaimLeadBodyDto shape", async () => {
    mockFetch([LEAD], (url, init) => {
      if (url.includes("/claim")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ salesHumanId: "sales-1" });
        return jsonResponse({ ...LEAD, assignedSalesId: "sales-1" });
      }
      return undefined;
    });
    render(<ContactsClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Assigned to untuk Pak Andi"), {
      target: { value: "sales-1" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Assigned to untuk Pak Andi")).toHaveValue("sales-1"),
    );
  });

  it("shows an empty state when there are no leads", async () => {
    mockFetch([]);
    render(<ContactsClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<ContactsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
