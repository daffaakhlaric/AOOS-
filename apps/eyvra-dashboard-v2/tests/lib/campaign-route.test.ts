// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/campaigns/route";
import { callAaosApi, AaosApiError } from "@/lib/api";
import type * as ApiModule from "@/lib/api";
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  callAaosApi: vi.fn(),
}));
vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: vi.fn().mockResolvedValue({ tenantId: "tenant" }),
}));
beforeEach(() => vi.mocked(callAaosApi).mockReset());
it("reports an exhausted connector instead of a successful empty portfolio", async () => {
  vi.mocked(callAaosApi)
    .mockResolvedValueOnce([{ id: "account", name: "Account" }])
    .mockRejectedValueOnce(new AaosApiError(429, "Rate limited"));
  const response = await GET(new NextRequest("http://localhost/api/campaigns"));
  expect(response.status).toBe(429);
  expect((await response.json()).error.message).toContain("Limit konektor Meta");
});
it("preserves available campaigns when only one account fails", async () => {
  vi.mocked(callAaosApi)
    .mockResolvedValueOnce([
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ])
    .mockResolvedValueOnce({ campaigns: [{ metaId: "campaign" }], syncedAt: "2026-09-21" })
    .mockRejectedValueOnce(new AaosApiError(429, "Rate limited"));
  const response = await GET(new NextRequest("http://localhost/api/campaigns"));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.campaigns).toHaveLength(1);
  expect(body.errors).toHaveLength(1);
});
