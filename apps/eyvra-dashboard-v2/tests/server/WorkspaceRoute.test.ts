// @vitest-environment node
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: session }));
import { GET } from "@/app/api/workspace/route";
it("only returns the current session workspace and disables caching", async () => {
  session.mockResolvedValue({
    userId: "private-id",
    email: "owner@example.test",
    tenantId: "property-tenant",
    vertical: "PROPERTY",
    role: "owner",
  });
  const response = await GET(new NextRequest("http://localhost/api/workspace?tenantId=other"));
  expect(await response.json()).toEqual({
    email: "owner@example.test",
    tenantId: "property-tenant",
    vertical: "PROPERTY",
    role: "owner",
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects missing sessions", async () => {
  session.mockResolvedValue(null);
  expect((await GET(new NextRequest("http://localhost/api/workspace"))).status).toBe(401);
});
