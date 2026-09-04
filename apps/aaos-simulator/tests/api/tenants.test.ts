import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/tenants/route";
import type { FetchTenantsResponse } from "@/types/simulator.types";

/**
 * `GET /api/tenants` (this task) — thin proxy to `src/lib/aaos-api-client.ts`'s `fetchTenants`.
 * Only `global.fetch` (the real `apps/aaos-api` HTTP boundary) is ever stubbed.
 */
describe("GET /api/tenants", () => {
  const originalBaseUrl = process.env["AAOS_API_BASE_URL"];
  const originalApiKey = process.env["AAOS_API_KEY"];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) {
      delete process.env["AAOS_API_BASE_URL"];
    } else {
      process.env["AAOS_API_BASE_URL"] = originalBaseUrl;
    }
    if (originalApiKey === undefined) {
      delete process.env["AAOS_API_KEY"];
    } else {
      process.env["AAOS_API_KEY"] = originalApiKey;
    }
  });

  it("returns 200 with an honest ok:false when AAOS_API_BASE_URL/AAOS_API_KEY are not configured (never a fabricated tenant list)", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    delete process.env["AAOS_API_KEY"];

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as FetchTenantsResponse;
    expect(body.ok).toBe(false);
  });

  it("returns 200 with the real tenant list when apps/aaos-api responds successfully", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              kpi: { totalTenants: 1, activeTenants: 1, trialTenants: 0, suspendedTenants: 0 },
              tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
            }),
            { status: 200 },
          ),
      ),
    );

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as FetchTenantsResponse;
    expect(body).toEqual({
      ok: true,
      tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
    });
  });
});
