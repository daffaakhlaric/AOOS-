// @vitest-environment node
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { session, api } = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: session }));
vi.mock("@/lib/api", () => ({ callAaosApi: api }));
import { GET } from "@/app/api/meta-interests/route";
it("takes tenant only from verified session", async () => {
  session.mockResolvedValue({ tenantId: "mine" });
  api.mockResolvedValue([]);
  const result = await GET(new NextRequest("http://localhost/api/meta-interests?tenantId=other"));
  expect(api).toHaveBeenCalledWith("/api/v1/meta-interests?tenantId=mine");
  expect(result.headers.get("cache-control")).toContain("no-store");
});
it("rejects missing session", async () => {
  api.mockClear();
  session.mockResolvedValue(null);
  expect((await GET(new NextRequest("http://localhost/api/meta-interests"))).status).toBe(401);
  expect(api).not.toHaveBeenCalled();
});
