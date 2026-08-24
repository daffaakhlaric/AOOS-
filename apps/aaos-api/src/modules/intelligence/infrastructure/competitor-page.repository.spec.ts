import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  CompetitorPageRepository,
  CompetitorPageRepositoryError,
} from "./competitor-page.repository.js";

describe("CompetitorPageRepository", () => {
  it("inserts a row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CompetitorPageRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      name: "Mobil88",
      page_id: "100063000000001",
      vertical: "AUTOMOTIVE",
      active: true,
    });
    expect(row.name).toBe("Mobil88");
    expect(row.vertical).toBe("AUTOMOTIVE");
  });

  it("findById returns undefined for a missing page", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CompetitorPageRepository(client);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("listByTenant returns only that tenant's pages", async () => {
    const client = createFakeSupabaseClient();
    client.seed("competitor_pages", {
      id: "p-1",
      tenant_id: "dss-motor",
      name: "Mobil88",
      page_id: "1",
      vertical: "AUTOMOTIVE",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("competitor_pages", {
      id: "p-2",
      tenant_id: "other-tenant",
      name: "OLX",
      page_id: "2",
      vertical: "AUTOMOTIVE",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CompetitorPageRepository(client);
    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Mobil88");
  });

  it("listActiveByTenantAndVertical filters by tenant, vertical, and active=true", async () => {
    const client = createFakeSupabaseClient();
    client.seed("competitor_pages", {
      id: "p-1",
      tenant_id: "dss-motor",
      name: "Active AUTOMOTIVE",
      page_id: "1",
      vertical: "AUTOMOTIVE",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("competitor_pages", {
      id: "p-2",
      tenant_id: "dss-motor",
      name: "Inactive AUTOMOTIVE",
      page_id: "2",
      vertical: "AUTOMOTIVE",
      active: false,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("competitor_pages", {
      id: "p-3",
      tenant_id: "dss-motor",
      name: "Active PROPERTY",
      page_id: "3",
      vertical: "PROPERTY",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CompetitorPageRepository(client);
    const rows = await repo.listActiveByTenantAndVertical("dss-motor", "AUTOMOTIVE");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Active AUTOMOTIVE");
  });

  it("deleteById removes the row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("competitor_pages", {
      id: "p-1",
      tenant_id: "dss-motor",
      name: "Mobil88",
      page_id: "1",
      vertical: "AUTOMOTIVE",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CompetitorPageRepository(client);
    await repo.deleteById("p-1");
    expect(await repo.findById("p-1")).toBeUndefined();
  });

  it("throws CompetitorPageRepositoryError when insert fails", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("competitor_pages", "boom");
    const repo = new CompetitorPageRepository(client);
    await expect(
      repo.insert({
        tenant_id: "dss-motor",
        name: "Mobil88",
        page_id: "1",
        vertical: "AUTOMOTIVE",
        active: true,
      }),
    ).rejects.toThrow(CompetitorPageRepositoryError);
  });
});
