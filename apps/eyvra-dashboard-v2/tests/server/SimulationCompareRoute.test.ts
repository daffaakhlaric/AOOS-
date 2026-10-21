// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { session, api } = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: session }));
vi.mock("@/lib/api", () => ({
  callAaosApi: api,
  AaosApiError: class extends Error {
    statusCode = 404;
  },
}));
import { GET } from "@/app/api/creative-stress-test/compare/route";
const run = {
  id: "a",
  name: "a",
  sourceType: "LISTING",
  listingId: "listing",
  creativeIds: [],
  mode: "STANDARD",
  primaryGoal: "CPQL",
  personaIds: [],
  objectionSources: [],
  status: "DRAFT",
  result: null,
  createdAt: "2026-09-28",
};
beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ tenantId: "verified-tenant" });
  api.mockImplementation(async (path: string) => ({ ...run, id: path.endsWith("/a") ? "a" : "b" }));
});
it("uses only the authenticated tenant for both reads and disables caching", async () => {
  const response = await GET(
    new NextRequest(
      "http://localhost/api/creative-stress-test/compare?runA=a&runB=b&tenantId=other",
    ),
  );
  expect(response.status).toBe(200);
  expect(api).toHaveBeenCalledWith("/api/v1/creative-stress-test/a", {
    headers: { "x-tenant-id": "verified-tenant" },
  });
  expect(api).toHaveBeenCalledWith("/api/v1/creative-stress-test/b", {
    headers: { "x-tenant-id": "verified-tenant" },
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects an unauthenticated read", async () => {
  session.mockResolvedValue(null);
  expect(
    (await GET(new NextRequest("http://localhost/api/creative-stress-test/compare?runA=a&runB=b")))
      .status,
  ).toBe(401);
  expect(api).not.toHaveBeenCalled();
});
it("rejects invalid ids before fetching", async () => {
  expect(
    (
      await GET(
        new NextRequest("http://localhost/api/creative-stress-test/compare?runA=../secret&runB=b"),
      )
    ).status,
  ).toBe(400);
  expect(api).not.toHaveBeenCalled();
});
it("does not expose backend error details or partial results", async () => {
  api.mockRejectedValue(new Error("private backend detail"));
  const response = await GET(
    new NextRequest("http://localhost/api/creative-stress-test/compare?runA=a&runB=b"),
  );
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private backend detail");
});
