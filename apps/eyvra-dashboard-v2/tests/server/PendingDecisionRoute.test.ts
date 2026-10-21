// @vitest-environment node
import { it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const { session, api } = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: session }));
vi.mock("@/lib/api", () => ({
  callAaosApi: api,
  AaosApiError: class extends Error {
    statusCode = 500;
  },
}));
import { POST } from "@/app/api/pending-actions/[id]/[decision]/route";
beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ role: "owner", tenantId: "actual-tenant", userId: "actual-user" });
  api.mockResolvedValue({ status: "APPROVED" });
});
it("uses verified identity and tenant for execution", async () => {
  const r = await POST(
    new NextRequest("http://localhost/api/pending-actions/a/approve", {
      method: "POST",
      body: JSON.stringify({ decidedBy: "forged", decisionNotes: "Reviewed" }),
    }),
    { params: { id: "a", decision: "approve" } },
  );
  expect(r.status).toBe(200);
  expect(api).toHaveBeenCalledWith(
    "/api/v1/pending-actions/a/approve",
    expect.objectContaining({
      headers: { "x-tenant-id": "actual-tenant" },
      body: { decidedBy: "actual-user", decisionNotes: "Reviewed" },
    }),
  );
});
it("blocks viewers before contacting executor", async () => {
  session.mockResolvedValue({ role: "sales" });
  expect(
    (await POST(new NextRequest("http://localhost"), { params: { id: "a", decision: "approve" } }))
      .status,
  ).toBe(403);
  expect(api).not.toHaveBeenCalled();
});
