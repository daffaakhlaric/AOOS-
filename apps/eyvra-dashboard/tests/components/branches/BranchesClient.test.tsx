import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BranchesClient } from "@/components/branches/BranchesClient";

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
  availableCount: 0,
  queueSize: 0,
  todayAssignedCount: 0,
};

describe("BranchesClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every branch card", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ branches: [BRANCH] }),
    ) as unknown as typeof fetch;
    render(<BranchesClient />);
    await waitFor(() => expect(screen.getByText("Cabang Bintaro")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<BranchesClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
