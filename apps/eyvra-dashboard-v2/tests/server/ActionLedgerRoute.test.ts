// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as ApiModule from "@/lib/api";
const mocks = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: mocks.session }));
vi.mock("@/lib/api", async (load) => ({
  ...(await load<typeof ApiModule>()),
  callAaosApi: mocks.api,
}));
import { GET, POST } from "@/app/api/actions/[[...path]]/route";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it("permits only the named read-only preflight subroute", async () => {
  const request = new NextRequest(`http://localhost/api/actions/${id}/preflight`);
  expect((await GET(request, { params: { path: [id, "preflight"] } })).status).toBe(200);
  expect(mocks.api).toHaveBeenCalledWith(
    `/api/v1/actions/${id}/preflight`,
    expect.objectContaining({ method: "GET", headers: { "x-tenant-id": "trusted" } }),
  );
  mocks.api.mockClear();
  expect((await GET(request, { params: { path: [id, "execute"] } })).status).toBe(400);
  expect(mocks.api).not.toHaveBeenCalled();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ tenantId: "trusted", role: "owner" });
  mocks.api.mockResolvedValue({ state: "APPROVED" });
});
function request(body: unknown = {}, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/actions/" + id + "/execute", {
    method: "POST",
    headers: { origin, "x-tenant-id": "forged" },
    body: JSON.stringify(body),
  });
}
it("rejects missing sessions without calling the API", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await GET(new NextRequest("http://localhost/api/actions"), { params: {} })).status).toBe(
    401,
  );
  expect(mocks.api).not.toHaveBeenCalled();
});
it("rejects cross-origin mutations", async () => {
  expect(
    (await POST(request({}, "https://other.example"), { params: { path: [id, "execute"] } }))
      .status,
  ).toBe(403);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("rejects viewer writes", async () => {
  mocks.session.mockResolvedValue({ tenantId: "trusted", role: "viewer" });
  expect((await POST(request(), { params: { path: [id, "execute"] } })).status).toBe(403);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("rejects caller-supplied actor and tenant", async () => {
  expect(
    (
      await POST(request({ tenantId: "forged", decidedBy: "admin" }), {
        params: { path: [id, "execute"] },
      })
    ).status,
  ).toBe(400);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("forwards approval hash with the trusted tenant", async () => {
  const body = { commandHash: "a".repeat(64) };
  expect((await POST(request(body), { params: { path: [id, "approve"] } })).status).toBe(200);
  expect(mocks.api).toHaveBeenCalledWith(
    `/api/v1/actions/${id}/approve`,
    expect.objectContaining({ body, headers: { "x-tenant-id": "trusted" } }),
  );
});
it("does not forward arbitrary action paths or invalid hashes", async () => {
  expect((await POST(request(), { params: { path: [id, "delete"] } })).status).toBe(400);
  expect(
    (await POST(request({ commandHash: "bad" }), { params: { path: [id, "approve"] } })).status,
  ).toBe(400);
  expect(mocks.api).not.toHaveBeenCalled();
});
