// @vitest-environment node
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: session }));
import { GET, POST } from "@/app/api/listing-editor/[...path]/route";
const context = { params: { path: ["listing-knowledge", "config"] } };
it("allows tenant-scoped Meta asset reads for automotive managers but not sales", async () => {
  const ctx = { params: { path: ["listings", "lead-destinations"] } };
  const req = new NextRequest(
    "http://localhost:3003/api/listing-editor/listings/lead-destinations",
  );
  session.mockResolvedValue({ role: "manager", vertical: "AUTOMOTIVE", tenantId: "tenant-a" });
  expect((await GET(req, ctx)).status).toBe(200);
  vi.mocked(fetch).mockClear();
  session.mockResolvedValue({ role: "sales", vertical: "AUTOMOTIVE", tenantId: "tenant-a" });
  expect((await GET(req, ctx)).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
beforeEach(() => {
  session.mockResolvedValue({ role: "manager", vertical: "PROPERTY", tenantId: "tenant-a" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  vi.stubEnv("AAOS_API_BASE_URL", "http://api.test");
  vi.stubEnv("AAOS_API_KEY", "test-only");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("rejects an unauthenticated session before upstream access", async () => {
  session.mockResolvedValue(null);
  expect(
    (
      await GET(
        new NextRequest("http://localhost:3003/api/listing-editor/listing-knowledge/config"),
        context,
      )
    ).status,
  ).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
it("allows format discovery in a non-property workspace so the file picker can open", async () => {
  session.mockResolvedValue({ role: "manager", vertical: "AUTOMOTIVE", tenantId: "tenant-a" });
  expect(
    (
      await GET(
        new NextRequest("http://localhost:3003/api/listing-editor/listing-knowledge/config"),
        context,
      )
    ).status,
  ).toBe(200);
});
it("still rejects non-property document access", async () => {
  session.mockResolvedValue({ role: "manager", vertical: "AUTOMOTIVE", tenantId: "tenant-a" });
  const id = "11111111-1111-4111-8111-111111111111";
  expect(
    (
      await GET(
        new NextRequest("http://localhost:3003/api/listing-editor/listing-knowledge/" + id),
        { params: { path: ["listing-knowledge", id] } },
      )
    ).status,
  ).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("does not exempt mutations to the config path", async () => {
  session.mockResolvedValue({ role: "manager", vertical: "AUTOMOTIVE", tenantId: "tenant-a" });
  expect(
    (
      await POST(
        new NextRequest("http://localhost:3003/api/listing-editor/listing-knowledge/config", {
          method: "POST",
        }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects sales-role writes", async () => {
  session.mockResolvedValue({ role: "sales", vertical: "PROPERTY", tenantId: "tenant-a" });
  expect(
    (
      await POST(
        new NextRequest("http://localhost:3003/api/listing-editor/listings/drafts", {
          method: "POST",
        }),
        { params: { path: ["listings", "drafts"] } },
      )
    ).status,
  ).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects cross-origin mutation", async () => {
  expect(
    (
      await POST(
        new NextRequest("http://localhost:3003/api/listing-editor/listings/drafts", {
          method: "POST",
          headers: { origin: "https://other.test" },
        }),
        { params: { path: ["listings", "drafts"] } },
      )
    ).status,
  ).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("takes tenant identity exclusively from the session", async () => {
  const response = await GET(
    new NextRequest("http://localhost:3003/api/listing-editor/listing-knowledge/config", {
      headers: { "x-tenant-id": "tenant-b" },
    }),
    context,
  );
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({ headers: expect.objectContaining({ "x-tenant-id": "tenant-a" }) }),
  );
});
it("rejects paths outside the editor endpoint allowlist", async () => {
  expect(
    (
      await GET(new NextRequest("http://localhost:3003/api/listing-editor/settings"), {
        params: { path: ["settings"] },
      })
    ).status,
  ).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
