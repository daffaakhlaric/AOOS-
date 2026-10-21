// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { session, api } = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: session }));
vi.mock("@/lib/api", () => ({
  callAaosApi: api,
  AaosApiError: class extends Error {
    statusCode = 503;
  },
}));
import { PUT, GET } from "@/app/api/automation/growth-policy/route";
beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ tenantId: "actual", userId: "verified-user", role: "owner" });
  api.mockResolvedValue({ version: 2 });
});
it("derives tenant and actor from session rather than incoming headers", async () => {
  await PUT(
    new NextRequest("http://localhost/api/automation/growth-policy", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "forged",
        "x-user-role": "owner",
      },
      body: JSON.stringify({ expectedVersion: 1, policy: {} }),
    }),
  );
  expect(api).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: { "x-tenant-id": "actual", "x-user-id": "verified-user", "x-user-role": "owner" },
    }),
  );
});
it("rejects a read-only sales user before contacting the API", async () => {
  session.mockResolvedValue({ tenantId: "actual", userId: "viewer", role: "sales" });
  expect(
    (await PUT(new NextRequest("http://localhost/api/automation/growth-policy", { method: "PUT" })))
      .status,
  ).toBe(403);
  expect(api).not.toHaveBeenCalled();
});
it("rejects missing authentication", async () => {
  session.mockResolvedValue(null);
  expect((await GET(new NextRequest("http://localhost/api/automation/growth-policy"))).status).toBe(
    401,
  );
});
