// @vitest-environment node
import type * as ApiModule from "@/lib/api";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: mocks.session }));
vi.mock("@/lib/api", async (load) => ({
  ...(await load<typeof ApiModule>()),
  callAaosApi: mocks.api,
}));
import { GET, POST } from "@/app/api/creative/projects/[id]/jobs/route";
const params = { id: "2450906c-50ce-4c65-8826-a38e4b8504cd" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ tenantId: "mine", role: "owner", vertical: "PROPERTY" });
  mocks.api.mockResolvedValue([]);
});
it("scopes status reads to the authenticated workspace and disables caching", async () => {
  const response = await GET(new NextRequest("http://localhost/api/jobs"), { params });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(mocks.api).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ headers: { "x-tenant-id": "mine" } }),
  );
});
it("rejects unauthenticated and non-property reads without accessing backend", async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect((await GET(new NextRequest("http://localhost/api/jobs"), { params })).status).toBe(401);
  mocks.session.mockResolvedValueOnce({ tenantId: "mine", vertical: "AUTOMOTIVE" });
  expect((await GET(new NextRequest("http://localhost/api/jobs"), { params })).status).toBe(403);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("rejects null JSON instead of crashing the enqueue route", async () => {
  const request = new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: "null",
  });
  expect((await POST(request, { params })).status).toBe(400);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("rejects cross-origin writes", async () => {
  const request = new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    headers: { origin: "https://other.test" },
    body: JSON.stringify({ conceptIds: [params.id] }),
  });
  expect((await POST(request, { params })).status).toBe(403);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("preserves sample mode and tenant when enqueueing a preview", async () => {
  const request = new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: JSON.stringify({
      conceptIds: [params.id],
      renderMode: "SAMPLE",
      reviewedRevisions: { [params.id]: 2 },
    }),
  });
  expect((await POST(request, { params })).status).toBe(200);
  expect(mocks.api).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      method: "POST",
      headers: { "x-tenant-id": "mine" },
      body: {
        conceptIds: [params.id],
        renderMode: "SAMPLE",
        reviewedRevisions: { [params.id]: 2 },
      },
    }),
  );
});
it.each([
  { conceptIds: [params.id], renderMode: "UNKNOWN" },
  { conceptIds: [params.id, params.id], renderMode: "SAMPLE" },
])("rejects invalid sample requests before enqueueing", async (body) => {
  const request = new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: JSON.stringify(body),
  });
  expect((await POST(request, { params })).status).toBe(400);
  expect(mocks.api).not.toHaveBeenCalled();
});
