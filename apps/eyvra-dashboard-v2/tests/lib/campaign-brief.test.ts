// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/campaigns/[campaignId]/brief/route";
import { callAaosApi } from "@/lib/api";
import type * as ApiModule from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof ApiModule>()),
  callAaosApi: vi.fn(),
}));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: vi.fn() }));
const request = () =>
  new NextRequest("http://localhost/api/campaigns/c/brief", {
    method: "POST",
    body: JSON.stringify({
      angle: "INVESTASI",
      message: "Refresh location concept",
      format: "IMAGES_ONLY",
    }),
  });
beforeEach(() => {
  vi.mocked(callAaosApi).mockReset();
  vi.mocked(resolveRouteSession).mockResolvedValue({
    userId: "u",
    tenantId: "tenant-b",
    role: "manager",
    vertical: "PROPERTY",
  });
});
it("creates only a draft using the server-resolved tenant listing", async () => {
  vi.mocked(callAaosApi)
    .mockResolvedValueOnce({ listingId: "owned-listing" })
    .mockResolvedValueOnce({ id: "draft", status: "DRAFT" });
  expect((await POST(request(), { params: { campaignId: "c" } })).status).toBe(201);
  expect(vi.mocked(callAaosApi).mock.calls[1]?.[1]).toMatchObject({
    headers: { "x-tenant-id": "tenant-b" },
    body: { listingId: "owned-listing", generate: false },
  });
});
it("does not create a package for an unlinked campaign", async () => {
  vi.mocked(callAaosApi).mockResolvedValueOnce({ listingId: null });
  expect((await POST(request(), { params: { campaignId: "c" } })).status).toBe(422);
  expect(callAaosApi).toHaveBeenCalledTimes(1);
});
it("rejects unauthenticated requests before reading upstream", async () => {
  vi.mocked(resolveRouteSession).mockResolvedValue(null);
  expect((await POST(request(), { params: { campaignId: "c" } })).status).toBe(401);
  expect(callAaosApi).not.toHaveBeenCalled();
});
