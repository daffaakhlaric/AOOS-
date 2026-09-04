import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/calendar/route";
import { DELETE, PUT } from "@/app/api/calendar/[id]/route";
import { POST as RUN_NOW } from "@/app/api/calendar/[id]/run-now/route";
import { POST as SKIP } from "@/app/api/calendar/[id]/skip/route";

function getRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function fetchMockReturning(response: Response): ReturnType<typeof vi.fn> {
  return vi.fn(async (_url: URL, _init?: RequestInit) => response);
}

describe("/api/calendar", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET forwards range=this_week to aaos-api and returns { events }", async () => {
    const fetchMock = fetchMockReturning(
      new Response(JSON.stringify([{ id: "evt-1" }]), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(getRequest("http://localhost/api/calendar?range=this_week"));
    const body = (await response.json()) as { events: unknown[] };
    expect(body.events).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit | undefined];
    expect(url.searchParams.get("range")).toBe("this_week");
  });

  it("GET forwards month=YYYY-MM", async () => {
    const fetchMock = fetchMockReturning(new Response(JSON.stringify([]), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await GET(getRequest("http://localhost/api/calendar?month=2026-08"));
    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit | undefined];
    expect(url.searchParams.get("month")).toBe("2026-08");
  });

  it("GET returns the upstream error status on failure", async () => {
    global.fetch = fetchMockReturning(
      new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(getRequest("http://localhost/api/calendar?range=this_week"));
    expect(response.status).toBe(500);
  });

  it("POST proxies the create body and returns 201 with { event }", async () => {
    const fetchMock = fetchMockReturning(
      new Response(JSON.stringify({ id: "evt-1" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = {
      eventType: "SCRAPER_RUN",
      title: "Scrape",
      scheduledAt: "2026-08-19T06:00:00+07:00",
      recurrence: "ONCE",
    };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(201);
    const responseBody = (await response.json()) as { event: { id: string } };
    expect(responseBody.event.id).toBe("evt-1");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("POST returns the upstream error status on validation failure", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ message: "invalid" }), { status: 400 }),
    ) as unknown as typeof fetch;
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
  });
});

describe("/api/calendar/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PUT proxies the patch body", async () => {
    const fetchMock = fetchMockReturning(
      new Response(JSON.stringify({ id: "evt-1", title: "Baru" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await PUT(postRequest({ title: "Baru" }), { params: { id: "evt-1" } });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/calendar/evt-1");
    expect(init.method).toBe("PUT");
  });

  it("DELETE proxies and returns 204", async () => {
    global.fetch = fetchMockReturning(
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const response = await DELETE(postRequest(undefined), { params: { id: "evt-1" } });
    expect(response.status).toBe(204);
  });

  it("run-now POST proxies to aaos-api's run-now endpoint", async () => {
    const fetchMock = fetchMockReturning(
      new Response(JSON.stringify({ id: "evt-1", status: "RUNNING" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await RUN_NOW(postRequest(undefined), { params: { id: "evt-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit | undefined];
    expect(url.pathname).toBe("/api/v1/calendar/evt-1/run-now");
  });

  it("skip POST proxies to aaos-api's skip endpoint", async () => {
    const fetchMock = fetchMockReturning(
      new Response(JSON.stringify({ id: "evt-1", status: "SKIPPED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await SKIP(postRequest(undefined), { params: { id: "evt-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit | undefined];
    expect(url.pathname).toBe("/api/v1/calendar/evt-1/skip");
  });
});
