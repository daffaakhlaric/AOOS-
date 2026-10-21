// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/creative-stress-test/[id]/send-to-kai/route";
import { callAaosApi } from "@/lib/api";
import type * as ApiModule from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof ApiModule>()),
  callAaosApi: vi.fn(),
}));
vi.mock("@/lib/route-session", () => ({ resolveRouteSession: vi.fn() }));

const request = () =>
  new NextRequest("http://localhost/api/creative-stress-test/run-1/send-to-kai", {
    method: "POST",
    body: JSON.stringify({
      angle: "INVESTASI",
      message: "Perbaiki CTA dan hindari klaim bebas banjir.",
      format: "IMAGES_ONLY",
    }),
  });

const RUN = {
  id: "run-1",
  name: "Run 1",
  sourceType: "LISTING",
  listingId: "listing-9",
  creativeIds: [],
  mode: "STANDARD",
  primaryGoal: "CREATIVE_QUALITY",
  personaIds: [],
  objectionSources: [],
  status: "COMPLETED",
  result: null,
  createdAt: "2026-09-28T00:00:00.000Z",
};

beforeEach(() => {
  vi.mocked(callAaosApi).mockReset();
  vi.mocked(resolveRouteSession).mockResolvedValue({
    userId: "u",
    tenantId: "tenant-b",
    role: "manager",
    vertical: "PROPERTY",
  });
});

it("creates a draft package using the run's server-resolved real listingId", async () => {
  vi.mocked(callAaosApi)
    .mockResolvedValueOnce(RUN)
    .mockResolvedValueOnce({ id: "pkg-1", status: "DRAFT" });
  const res = await POST(request(), { params: { id: "run-1" } });
  expect(res.status).toBe(201);
  expect(vi.mocked(callAaosApi).mock.calls[1]?.[1]).toMatchObject({
    headers: { "x-tenant-id": "tenant-b" },
    body: { listingId: "listing-9", generate: false, angle: "INVESTASI", format: "IMAGES_ONLY" },
  });
});

it("rejects unauthenticated requests before reading upstream", async () => {
  vi.mocked(resolveRouteSession).mockResolvedValue(null);
  const res = await POST(request(), { params: { id: "run-1" } });
  expect(res.status).toBe(401);
  expect(callAaosApi).not.toHaveBeenCalled();
});

it("rejects a sales-role session with 403", async () => {
  vi.mocked(resolveRouteSession).mockResolvedValue({
    userId: "u",
    tenantId: "tenant-b",
    role: "sales",
    vertical: "PROPERTY",
  });
  const res = await POST(request(), { params: { id: "run-1" } });
  expect(res.status).toBe(403);
  expect(callAaosApi).not.toHaveBeenCalled();
});

it("rejects a non-PROPERTY vertical with 422 before reading upstream", async () => {
  vi.mocked(resolveRouteSession).mockResolvedValue({
    userId: "u",
    tenantId: "tenant-b",
    role: "manager",
    vertical: "AUTOMOTIVE",
  });
  const res = await POST(request(), { params: { id: "run-1" } });
  expect(res.status).toBe(422);
  expect(callAaosApi).not.toHaveBeenCalled();
});

it("rejects a missing/invalid angle, format, or message with 400 before reading upstream", async () => {
  const badRequest = new NextRequest(
    "http://localhost/api/creative-stress-test/run-1/send-to-kai",
    {
      method: "POST",
      body: JSON.stringify({ angle: "NOT_REAL", message: "", format: "IMAGES_ONLY" }),
    },
  );
  const res = await POST(badRequest, { params: { id: "run-1" } });
  expect(res.status).toBe(400);
  expect(callAaosApi).not.toHaveBeenCalled();
});

it("rejects a run whose sourceType is not LISTING — that path belongs to the campaign brief route", async () => {
  vi.mocked(callAaosApi).mockResolvedValueOnce({
    ...RUN,
    sourceType: "CAMPAIGN",
    listingId: undefined,
    campaignId: "c1",
  });
  const res = await POST(request(), { params: { id: "run-1" } });
  expect(res.status).toBe(422);
  expect(callAaosApi).toHaveBeenCalledTimes(1);
});

it("rejects a run that has not reached COMPLETED", async () => {
  vi.mocked(callAaosApi).mockResolvedValueOnce({ ...RUN, status: "RUNNING" });
  const res = await POST(request(), { params: { id: "run-1" } });
  expect(res.status).toBe(422);
  expect(callAaosApi).toHaveBeenCalledTimes(1);
});
