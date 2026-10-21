// @vitest-environment node
import type * as ApiModule from "@/lib/api";
import { expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), api: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: mocks.session }));
vi.mock("@/lib/api", async (load) => ({
  ...(await load<typeof ApiModule>()),
  callAaosApi: mocks.api,
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.read }));
import { AaosApiError } from "@/lib/api";
import { POST, GET } from "@/app/api/campaign-drafts/route";
const draft = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  listingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Draft",
  goal: "WhatsApp Leads",
  dailyBudget: 300000,
  start: "2026-10-02",
  end: "2026-10-04",
  copyIndex: 0,
  revision: 2,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ tenantId: "mine", vertical: "PROPERTY", role: "owner" });
  mocks.api.mockResolvedValue({ ...draft, revision: 3, status: "READY", kaiProjectId: "project" });
});
function request(origin = "http://localhost", body: unknown = draft) {
  return new NextRequest("http://localhost/api/campaign-drafts", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(body),
  });
}
it("uses the atomic backend save with authenticated tenant and revision; ignores forged links", async () => {
  const response = await POST(
    request("http://localhost", {
      ...draft,
      tenantId: "foreign",
      kaiBriefId: "fake",
      shortlistedCreativeIds: ["fake"],
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.api).toHaveBeenCalledWith(
    "/api/v1/creative-packages/handoff/drafts",
    expect.objectContaining({
      method: "POST",
      headers: { "x-tenant-id": "mine" },
      body: {
        id: draft.id,
        listingId: draft.listingId,
        name: draft.name,
        goal: draft.goal,
        dailyBudget: draft.dailyBudget,
        start: draft.start,
        end: draft.end,
        copyIndex: 0,
        expectedRevision: 2,
        metaDestination: null,
      },
    }),
  );
  expect((await response.json()).kaiProjectId).toBe("project");
});
it("blocks cross-origin requests and sales writes", async () => {
  expect((await POST(request("https://evil.test"))).status).toBe(403);
  mocks.session.mockResolvedValue({ tenantId: "mine", vertical: "PROPERTY", role: "sales" });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("preserves backend revision conflicts and validation failures", async () => {
  mocks.api.mockRejectedValueOnce(new AaosApiError(409, "Draft berubah"));
  expect((await POST(request())).status).toBe(409);
  mocks.api.mockRejectedValueOnce(new AaosApiError(400, "Destination invalid"));
  expect((await POST(request())).status).toBe(400);
});
it("rejects unauthenticated reads", async () => {
  mocks.session.mockResolvedValue(null);
  expect(
    (await GET(new NextRequest("http://localhost/api/campaign-drafts?id=" + draft.id))).status,
  ).toBe(401);
});
it("loads persisted links from Supabase and never reads a legacy file on service failure", async () => {
  const req = new NextRequest("http://localhost/api/campaign-drafts?id=" + draft.id);
  expect((await GET(req)).status).toBe(200);
  mocks.api.mockRejectedValue(new AaosApiError(503, "Offline"));
  expect((await GET(req)).status).toBe(503);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("keeps legacy drafts recoverable only after a backend 404", async () => {
  mocks.api.mockRejectedValue(new AaosApiError(404, "Not found"));
  mocks.read.mockResolvedValue(JSON.stringify(draft));
  const response = await GET(
    new NextRequest("http://localhost/api/campaign-drafts?id=" + draft.id),
  );
  expect(await response.json()).toMatchObject({ revision: 0, migrationRequired: true });
});
