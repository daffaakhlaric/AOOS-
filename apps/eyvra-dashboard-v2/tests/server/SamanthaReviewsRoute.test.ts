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
import { GET } from "@/app/api/samantha/reviews/route";
beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ tenantId: "verified" });
  api.mockResolvedValue([]);
});
it("scopes calendar reads to the authenticated tenant, not query input", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/samantha/reviews?tenantId=other"),
  );
  expect(response.status).toBe(200);
  expect(api).toHaveBeenCalledWith("/api/v1/calendar", {
    headers: { "x-tenant-id": "verified" },
    searchParams: { range: "this_week" },
  });
});
it("does not contact the API without a session", async () => {
  session.mockResolvedValue(null);
  expect((await GET(new NextRequest("http://localhost/api/samantha/reviews"))).status).toBe(401);
  expect(api).not.toHaveBeenCalled();
});
it("does not leak upstream error details", async () => {
  api.mockRejectedValue(new Error("private detail"));
  const response = await GET(new NextRequest("http://localhost/api/samantha/reviews"));
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private detail");
});
