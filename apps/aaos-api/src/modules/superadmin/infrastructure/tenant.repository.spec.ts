import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { TenantRepository, TenantRepositoryError } from "./tenant.repository.js";

describe("TenantRepository", () => {
  it("rejects stale credential updates without replacing the newer account", async () => {
    const client = createFakeSupabaseClient();
    client.seed("tenants", {
      tenant_id: "workspace-a",
      meta_credential_version: 3,
      meta_ad_account_id: "act_333",
    });
    const repo = new TenantRepository(client);
    await expect(
      repo.updateMetaAtVersion("workspace-a", 2, { meta_ad_account_id: "act_222" }),
    ).rejects.toThrow("Integration changed");
    expect((await repo.findByTenantId("workspace-a"))?.meta_ad_account_id).toBe("act_333");
    await repo.updateMetaAtVersion("workspace-a", 3, { meta_ad_account_id: "act_444" });
    expect((await repo.findByTenantId("workspace-a"))?.meta_ad_account_id).toBe("act_444");
  });
  it("inserts a row and returns it (including the DB-generated id)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new TenantRepository(client);
    const row = await repo.insert({
      tenant_id: "propertyklik-demo",
      name: "PropertyKlik Demo",
      vertical: "PROPERTY",
      status: "TRIAL",
      trial_ends_at: null,
      meta_access_token: null,
      meta_ad_account_id: null,
      meta_api_version: "v21.0",
    });
    expect(row.tenant_id).toBe("propertyklik-demo");
    expect(row.vertical).toBe("PROPERTY");
  });

  it("findByTenantId returns undefined for a missing tenant", async () => {
    const client = createFakeSupabaseClient();
    const repo = new TenantRepository(client);
    const found = await repo.findByTenantId("missing");
    expect(found).toBeUndefined();
  });

  it("findByTenantId returns the seeded row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("tenants", {
      id: "t-1",
      tenant_id: "dss-motor",
      name: "DSS Motor (Mobix)",
      vertical: "AUTOMOTIVE",
      status: "ACTIVE",
      trial_ends_at: null,
      meta_access_token: null,
      meta_ad_account_id: null,
      meta_api_version: "v21.0",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new TenantRepository(client);
    const found = await repo.findByTenantId("dss-motor");
    expect(found?.name).toBe("DSS Motor (Mobix)");
  });

  it("list returns every tenant, ordered by created_at", async () => {
    const client = createFakeSupabaseClient();
    client.seed("tenants", {
      id: "t-1",
      tenant_id: "dss-motor",
      name: "DSS Motor",
      vertical: "AUTOMOTIVE",
      status: "ACTIVE",
      trial_ends_at: null,
      meta_access_token: null,
      meta_ad_account_id: null,
      meta_api_version: "v21.0",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("tenants", {
      id: "t-2",
      tenant_id: "propertyklik-demo",
      name: "PropertyKlik Demo",
      vertical: "PROPERTY",
      status: "TRIAL",
      trial_ends_at: null,
      meta_access_token: null,
      meta_ad_account_id: null,
      meta_api_version: "v21.0",
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    const repo = new TenantRepository(client);
    const all = await repo.list();
    expect(all).toHaveLength(2);
    expect(all[0]?.tenant_id).toBe("dss-motor");
  });

  it("updateByTenantId patches the row in place", async () => {
    const client = createFakeSupabaseClient();
    client.seed("tenants", {
      id: "t-1",
      tenant_id: "dss-motor",
      name: "DSS Motor",
      vertical: "AUTOMOTIVE",
      status: "ACTIVE",
      trial_ends_at: null,
      meta_access_token: null,
      meta_ad_account_id: null,
      meta_api_version: "v21.0",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new TenantRepository(client);
    const updated = await repo.updateByTenantId("dss-motor", { status: "SUSPENDED" });
    expect(updated.status).toBe("SUSPENDED");
  });

  it("throws TenantRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("tenants", "boom");
    const repo = new TenantRepository(client);
    await expect(repo.list()).rejects.toThrow(TenantRepositoryError);
  });
});
