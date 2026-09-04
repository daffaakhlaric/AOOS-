import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET, POST } from "@/app/api/property-objective/route";
import { GET as getBudgetSuggestion } from "@/app/api/property-objective/budget-suggestion/route";

function jsonRequest(
  body: unknown = {},
  url = "http://localhost/api/property-objective",
): NextRequest {
  return {
    json: () => Promise.resolve(body),
    url,
  } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("GET/POST /api/property-objective", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("GET returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(jsonRequest());
    expect(response.status).toBe(401);
  });

  it("GET proxies to aaos-api's GET /api/v1/property-objective and forwards x-tenant-id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "po-1", status: "DRAFT" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(jsonRequest());
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/property-objective");
    expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("propertyklik-demo");
  });

  it("GET returns { objective: null } with a 200 when aaos-api returns 404 (no objective set yet)", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    ) as unknown as typeof fetch;
    const response = await GET(jsonRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { objective: null };
    expect(body.objective).toBeNull();
  });

  it("POST returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await POST(jsonRequest());
    expect(response.status).toBe(401);
  });

  it("POST proxies the real request body to aaos-api's POST /api/v1/property-objective and forwards x-tenant-id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "po-2", status: "DRAFT" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const body = {
      targetHotLeads: 30,
      budgetAllocation: 15_000_000,
      budgetSource: "SAMANTHA_SUGGESTED",
      focusListings: ["Cluster Anggrek"],
      areaPriorities: ["Bintaro"],
    };
    const response = await POST(jsonRequest(body));
    expect(response.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/property-objective");
    expect(init?.body).toBe(JSON.stringify(body));
    expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("propertyklik-demo");
  });
});

describe("GET /api/property-objective/budget-suggestion", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await getBudgetSuggestion(
      jsonRequest(
        {},
        "http://localhost/api/property-objective/budget-suggestion?targetHotLeads=30",
      ),
    );
    expect(response.status).toBe(401);
  });

  it("proxies targetHotLeads to aaos-api's GET /api/v1/property-objective/budget-suggestion and still forwards x-tenant-id for consistency (even though this one aaos-api endpoint doesn't consume it yet)", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            available: true,
            suggestedBudget: 9_000_000,
            portfolioAvgCplIDR: 300_000,
            targetHotLeads: 30,
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await getBudgetSuggestion(
      jsonRequest(
        {},
        "http://localhost/api/property-objective/budget-suggestion?targetHotLeads=30",
      ),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/property-objective/budget-suggestion");
    expect((url as URL).searchParams.get("targetHotLeads")).toBe("30");
    expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("propertyklik-demo");
    const body = (await response.json()) as { available: boolean; suggestedBudget?: number };
    expect(body.available).toBe(true);
    expect(body.suggestedBudget).toBe(9_000_000);
  });

  it("passes through the real honest { available: false, reason } shape unchanged", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ available: false, reason: "Belum ada data campaign untuk tenant ini." }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const response = await getBudgetSuggestion(
      jsonRequest(
        {},
        "http://localhost/api/property-objective/budget-suggestion?targetHotLeads=30",
      ),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { available: boolean; reason?: string };
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/Belum ada data/);
  });
});
