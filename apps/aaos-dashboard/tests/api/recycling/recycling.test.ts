import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_POOL } from "@/app/api/recycling/pool/route";
import { GET as GET_TEMPLATES, POST as POST_TEMPLATE } from "@/app/api/recycling/templates/route";
import { PUT as PUT_TEMPLATE } from "@/app/api/recycling/templates/[id]/route";
import { POST as POST_BROADCAST } from "@/app/api/recycling/broadcast/[leadId]/route";
import { POST as POST_BROADCAST_ALL } from "@/app/api/recycling/broadcast-all/route";
import { GET as GET_LOGS } from "@/app/api/recycling/logs/route";
import { GET as GET_AUTO_MODE, POST as POST_AUTO_MODE } from "@/app/api/recycling/auto-mode/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/recycling/logs");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function fetchMockReturning(response: Response): ReturnType<typeof vi.fn> {
  return vi.fn(async () => response);
}

describe("/api/recycling", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /pool proxies aaos-api's real GET /api/v1/recycling/pool", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify([{ id: "lead-1", readyToSend: true }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await GET_POOL();
    const body = (await response.json()) as { leads: unknown[] };
    expect(body.leads).toHaveLength(1);
  });

  it("GET /pool returns the upstream error status on failure", async () => {
    global.fetch = fetchMockReturning(
      new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET_POOL();
    expect(response.status).toBe(500);
  });

  it("GET /templates proxies the real template list", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify([{ id: "t-1", name: "Promo DP Ringan" }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await GET_TEMPLATES();
    const body = (await response.json()) as { templates: unknown[] };
    expect(body.templates).toHaveLength(1);
  });

  it("POST /templates forwards the create body and returns 201", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(JSON.parse(init?.body as string)).toEqual({
        name: "Promo DP Ringan",
        content: "Halo {nama}!",
        targetStatuses: ["WARM"],
        cooldownDays: 3,
        status: "ACTIVE",
      });
      return new Response(JSON.stringify({ id: "t-1" }), { status: 201 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_TEMPLATE(
      postRequest({
        name: "Promo DP Ringan",
        content: "Halo {nama}!",
        targetStatuses: ["WARM"],
        cooldownDays: 3,
        status: "ACTIVE",
      }),
    );
    expect(response.status).toBe(201);
  });

  it("PUT /templates/:id forwards to the real update endpoint", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/recycling/templates/t-1");
      return new Response(JSON.stringify({ id: "t-1", status: "INACTIVE" }), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT_TEMPLATE(postRequest({ status: "INACTIVE" }), {
      params: { id: "t-1" },
    });
    const body = (await response.json()) as { template: { status: string } };
    expect(body.template.status).toBe("INACTIVE");
  });

  it("POST /broadcast/:leadId forwards templateId and returns the real result", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/recycling/broadcast/lead-1");
      expect(JSON.parse(init?.body as string)).toEqual({ templateId: "template-1" });
      return new Response(
        JSON.stringify({
          leadId: "lead-1",
          templateId: "template-1",
          broadcastLogId: "log-1",
          sentAt: "2026-01-15T08:00:00.000Z",
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_BROADCAST(postRequest({ templateId: "template-1" }), {
      params: { leadId: "lead-1" },
    });
    const body = (await response.json()) as { broadcastLogId: string };
    expect(body.broadcastLogId).toBe("log-1");
  });

  it("POST /broadcast-all proxies the real bulk-send endpoint", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ attempted: 2, sent: [], failed: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await POST_BROADCAST_ALL();
    const body = (await response.json()) as { attempted: number };
    expect(body.attempted).toBe(2);
  });

  it("GET /logs forwards the limit query param", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("limit")).toBe("50");
      return new Response(JSON.stringify([]), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await GET_LOGS(requestWith({ limit: "50" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("GET /auto-mode proxies the real current flag", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ autoMode: true }), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await GET_AUTO_MODE();
    const body = (await response.json()) as { autoMode: boolean };
    expect(body.autoMode).toBe(true);
  });

  it("POST /auto-mode forwards the new flag and persists it", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(JSON.parse(init?.body as string)).toEqual({ autoMode: false });
      return new Response(JSON.stringify({ autoMode: false }), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_AUTO_MODE(postRequest({ autoMode: false }));
    const body = (await response.json()) as { autoMode: boolean };
    expect(body.autoMode).toBe(false);
  });
});
